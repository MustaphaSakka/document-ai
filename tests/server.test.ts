/**
 * Tests for HTTP server functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server';

let server: http.Server;
let baseUrl: string;

describe('HTTP Server', () => {
  beforeAll(() => {
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

    it('should return JSON content type for 404', async () => {
      const response = await fetch(`${baseUrl}/unknown`);
      expect(response.headers.get('content-type')).toBe('application/json');
    });
  });

  describe('Server functionality', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => fetch(`${baseUrl}/health`));
      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });
});
