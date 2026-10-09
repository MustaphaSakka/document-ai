/**
 * The guard that stops a destructive operation from running against a database
 * that is not a test one.
 *
 * src/db.ts reads DATABASE_URL once, at import time, so this test reloads the
 * module with a different value rather than mutating the already-loaded one.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';

describe('test database guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should allow a destructive operation on a test database', async () => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', 'postgresql://some-user:some-password@localhost:5432/other_test');

    const { assertTestDatabase, databaseName } = await import('../src/db.js');

    // Any name ending in _test is accepted, wherever it points.
    expect(databaseName).toBe('other_test');
    expect(() => assertTestDatabase()).not.toThrow();
  });

  it('should refuse it on the development database', async () => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', 'postgresql://document_ai:document_ai@localhost:5432/document_ai');

    const { assertTestDatabase, databaseName } = await import('../src/db.js');

    expect(databaseName).toBe('document_ai');
    // The message names the database, so a misconfiguration is obvious.
    expect(() => assertTestDatabase()).toThrow(/document_ai".*must end with "_test"/s);
  });

  it('should refuse a connection string that is not a URL', async () => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', 'this-is-not-a-url');

    await expect(import('../src/db.js')).rejects.toThrow(/not a valid connection URL/);
  });

  it('should refuse to start without a connection string', async () => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', '');

    // An empty value counts as absent: the fallback must not quietly point
    // somewhere else.
    await expect(import('../src/db.js')).rejects.toThrow(/DATABASE_URL environment variable/);
  });
});
