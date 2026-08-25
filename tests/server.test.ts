/**
 * Tests for HTTP server functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
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

    // Ensure temp directory exists
    if (!fs.existsSync('temp')) {
      fs.mkdirSync('temp', { recursive: true });
    }

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

  describe('GET /documents/:id', () => {
    beforeEach(() => {
      documentService.clearDocuments();
      resetIdCounter();
    });

    it('should return 404 for non-existent document', async () => {
      const response = await fetch(`${baseUrl}/documents/non-existent`);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Not Found');
      expect(data.message).toContain('not found');
    });

    it('should return document with pending status', async () => {
      // Create a document directly
      const document = documentService.createDocument({
        name: 'pending-doc.pdf',
        size: 1024,
        mimetype: 'application/pdf',
      });

      const response = await fetch(`${baseUrl}/documents/${document.id}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      const data = await response.json();
      expect(data.id).toBe(document.id);
      expect(data.name).toBe('pending-doc.pdf');
      expect(data.status).toBe('pending');
      expect(data.size).toBe(1024);
      expect(data.mimetype).toBe('application/pdf');
      expect(data.processingResult).toBeUndefined();
    });

    it('should return document with completed status and results', async () => {
      // Create a document without a file (simulating completed state)
      const document = documentService.createDocument({
        name: 'completed-doc.txt',
        size: 1024,
        mimetype: 'application/pdf',
      });

      // Manually set to completed with processing results
      const { documentService: ds } = await import('../src/document-service.js');
      ds.updateDocumentResult(document.id, {
        wordCount: 250,
        pageEstimated: 1,
        processingDuration: 100,
        processedAt: new Date(),
      });

      // Get the document
      const response = await fetch(`${baseUrl}/documents/${document.id}`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('completed');
      expect(data.processingResult).toBeDefined();
      expect(data.processingResult.wordCount).toBe(250);
      expect(data.processingResult.pageEstimated).toBe(1);
      expect(data.processingResult.processingDuration).toBe(100);
      expect(data.processingResult.processedAt).toBeDefined();
    });

    it('should return document with failed status and error', async () => {
      // Create a document without a file
      const document = documentService.createDocument({
        name: 'failed-doc.txt',
      });

      // Trigger processing (will fail since no file exists)
      const { triggerDocumentProcessing } = await import('../src/processor.js');
      triggerDocumentProcessing(document.id);

      // Wait for processing to fail
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Get the document
      const response = await fetch(`${baseUrl}/documents/${document.id}`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('failed');
      expect(data.error).toBeDefined();
      expect(data.processingResult).toBeUndefined();
    }, 10000);

    it('should return 400 for invalid document ID format', async () => {
      const response = await fetch(`${baseUrl}/documents/`);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Bad Request');
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
