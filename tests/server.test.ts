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
    beforeEach(() => {
      documentService.clearDocuments();
      resetIdCounter();
    });

    describe('Successful document creation', () => {
      it('should return 201 status code', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'invoice-001.pdf' }),
        });
        expect(response.status).toBe(201);
      });

      it('should return JSON content type', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'document.pdf' }),
        });
        expect(response.headers.get('content-type')).toBe('application/json');
      });

      it('should return Location header', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'document.pdf' }),
        });
        const location = response.headers.get('location');
        expect(location).toMatch(/^\/documents\/doc_/);
      });

      it('should return document data in response', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'invoice-001.pdf' }),
        });
        const data = await response.json();

        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', 'invoice-001.pdf');
        expect(data).toHaveProperty('status', 'pending');
      });

      it('should trim whitespace from document name', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '  document.pdf  ' }),
        });
        const data = await response.json();

        expect(data.name).toBe('document.pdf');
      });

      it('should generate unique IDs for different documents', async () => {
        const response1 = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'doc1.pdf' }),
        });
        const data1 = await response1.json();

        const response2 = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'doc2.pdf' }),
        });
        const data2 = await response2.json();

        expect(data1.id).not.toBe(data2.id);
      });
    });

    describe('Validation errors', () => {
      it('should return 400 for missing name field', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBe('Validation Error');
        expect(data.message).toContain('name');
      });

      it('should return 400 for non-string name', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 123 }),
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBe('Validation Error');
      });

      it('should return 400 for empty name', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '   ' }),
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBe('Validation Error');
        expect(data.message).toContain('empty');
      });

      it('should return 400 for malformed JSON', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid json }',
        });
        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.error).toBe('Bad Request');
        expect(data.message).toContain('JSON');
      });
    });

    describe('Content-Type validation', () => {
      it('should return 415 for missing Content-Type header', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          body: JSON.stringify({ name: 'document.pdf' }),
        });
        expect(response.status).toBe(415);

        const data = await response.json();
        expect(data.error).toBe('Unsupported Media Type');
      });

      it('should return 415 for wrong Content-Type', async () => {
        const response = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ name: 'document.pdf' }),
        });
        expect(response.status).toBe(415);

        const data = await response.json();
        expect(data.error).toBe('Unsupported Media Type');
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

    it('should handle concurrent document creation', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `document-${i}.pdf` }),
        }),
      );

      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status).toBe(201);
      }

      const allDocs = documentService.getAllDocuments();
      expect(allDocs).toHaveLength(5);
    });
  });
});
