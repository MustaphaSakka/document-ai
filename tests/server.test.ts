/**
 * Tests for HTTP server functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server';
import { documentService } from '../src/document-service';
import { resetIdCounter } from '../src/utils';

let server: http.Server;
let baseUrl: string;

describe('HTTP Server', () => {
  beforeAll(() => {
    // Reset state before tests
    documentService.clearDocuments();
    resetIdCounter();

    // Start server on random available port for testing
    server = createServer();
    server.listen(0);

    const address = server.address();
    if (address && typeof address === 'object') {
      baseUrl = `http://localhost:${address.port}`;
    }
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('GET /health', () => {
    it('should return 200 status code', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
    });

    it('should return JSON content type', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should return status ok in response body', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });
    });
  });

  describe('POST /documents', () => {
    describe('Content-Type validation', () => {
      it('should return 415 for non-multipart content type', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'test.pdf' }),
        });

        expect(response.status).toBe(415);

        const data = await response.json();
        expect(data.error).toBe('Unsupported Media Type');
        expect(data.message).toContain('multipart/form-data');
      });

      it('should return 415 for missing Content-Type header', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          body: 'some data',
        });

        expect(response.status).toBe(415);
      });
    });

    describe('Missing file', () => {
      it('should reject upload without file', async () => {
        const formData = new FormData();
        // Don't add any file

        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          body: formData,
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBe('Bad Request');
        expect(data.message).toContain('No file provided');
      });
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for non-existent route', async () => {
      const response = await fetch(`${baseUrl}/unknown`);
      expect(response.status).toBe(404);
    });

    it('should return JSON error response for unknown route', async () => {
      const response = await fetch(`${baseUrl}/unknown`);
      const data = await response.json();
      expect(data).toEqual({ error: 'Not Found' });
    });

    it('should return 404 for unsupported methods on known routes', async () => {
      const response = await fetch(`${baseUrl}/documents`, {
        method: 'GET',
      });
      expect(response.status).toBe(404);
    });
  });

  describe('Server functionality', () => {
    beforeEach(() => {
      documentService.clearDocuments();
      resetIdCounter();
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => fetch(`${baseUrl}/health`));
      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    it('should handle concurrent requests to health endpoint', async () => {
      const requests = Array.from({ length: 5 }, () => fetch(`${baseUrl}/health`));
      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });
});
