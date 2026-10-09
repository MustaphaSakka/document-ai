/**
 * What the API does when PostgreSQL cannot be reached.
 *
 * The pool is closed on purpose, so this file is deliberately self-contained:
 * it depends on nothing another file set up and leaves nothing behind. Vitest
 * gives each test file its own module registry, so the closed pool does not
 * leak into the other files.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server.js';
import { closeDatabase } from '../src/db.js';

let server: http.Server;
let baseUrl: string;

describe('Document API without a database', () => {
  beforeAll(async () => {
    server = createServer();
    server.listen(0);

    const address = server.address();
    if (address && typeof address === 'object') {
      baseUrl = `http://localhost:${address.port}`;
    }

    // The equivalent of PostgreSQL going away while the API keeps running.
    await closeDatabase();
  });

  afterAll(() => {
    server.close();
  });

  it('should still answer the health check', async () => {
    // Health does not touch the database and must keep working: an unreachable
    // database should not make the process look dead.
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('should return 500 rather than crash when listing documents', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await fetch(`${baseUrl}/documents`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
    // Reported rather than swallowed silently.
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should return 500 when reading a document', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await fetch(`${baseUrl}/documents/any-id`);

    expect(response.status).toBe(500);
    errorSpy.mockRestore();
  });

  it('should return 500 when creating a document', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const boundary = '----test-boundary-no-db';
    const crlf = '\r\n';
    const formData =
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="file"; filename="orphan.pdf"${crlf}` +
      `Content-Type: application/pdf${crlf}${crlf}` +
      'Sample PDF content' +
      `${crlf}--${boundary}--${crlf}`;

    // S3 is mocked, so the upload succeeds and the failure comes from the
    // database write that follows it.
    const response = await fetch(`${baseUrl}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: formData,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Internal Server Error',
      message: 'An error occurred while creating the document',
    });
    errorSpy.mockRestore();
  });

  it('should keep serving requests after a failure', async () => {
    const first = await fetch(`${baseUrl}/documents`);
    const second = await fetch(`${baseUrl}/health`);

    expect(first.status).toBe(500);
    // One failing request must not take the process down with it.
    expect(second.status).toBe(200);
  });
});
