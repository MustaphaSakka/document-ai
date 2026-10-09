/**
 * Tests for the document management endpoints: list, status, text and delete
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server';
import { documentService } from '../src/document-service';
import { s3Client } from '../src/s3-client';
import { resetIdCounter } from '../src/utils';
import { setCreatedAt } from './db.js';

let server: http.Server;
let baseUrl: string;

const S3_KEY = 'documents/11111111-2222-3333-4444-555555555555.pdf';
const EXTRACTED_KEY = 'documents/11111111-2222-3333-4444-555555555555-extracted.json';

/** Create a document that finished processing and has extracted text */
async function seedCompletedDocument(name = 'report.pdf') {
  const document = await documentService.createDocument({
    name,
    s3Bucket: 'test-bucket',
    s3Key: S3_KEY,
    size: 2048,
    mimetype: 'application/pdf',
  });

  await documentService.updateDocumentResult(document.id, {
    wordCount: 4,
    pageEstimated: 1,
    processingDuration: 12,
    processedAt: new Date('2026-02-01T10:00:00.000Z'),
    extractedText: 'Hello from the PDF',
    numpages: 1,
  });

  return document;
}

/** Keys passed to DeleteObjectCommand, in call order */
function deletedKeys(): string[] {
  return vi
    .mocked(s3Client.send)
    .mock.calls.filter(([command]) => command.constructor.name === 'DeleteObjectCommand')
    .map(([command]) => (command as unknown as { input: { Key: string } }).input.Key);
}

describe('Document management endpoints', () => {
  beforeAll(() => {
    server = createServer();
    server.listen(0);

    const address = server.address();
    if (address && typeof address === 'object') {
      baseUrl = `http://localhost:${address.port}`;
    }
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(async () => {
    await documentService.clearDocuments();
    resetIdCounter();
    vi.clearAllMocks();
  });

  describe('GET /documents', () => {
    it('should return an empty list', async () => {
      const response = await fetch(`${baseUrl}/documents`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(await response.json()).toEqual({ documents: [], total: 0 });
    });

    it('should return all documents, most recent first', async () => {
      // created_at belongs to the database now: the timestamps are written
      // there instead of onto the returned objects, which are only copies.
      const oldest = await documentService.createDocument({ name: 'oldest.txt' });
      const newest = await documentService.createDocument({ name: 'newest.txt' });
      const middle = await documentService.createDocument({ name: 'middle.txt' });

      await setCreatedAt(oldest.id, new Date('2026-01-01T00:00:00.000Z'));
      await setCreatedAt(newest.id, new Date('2026-03-01T00:00:00.000Z'));
      await setCreatedAt(middle.id, new Date('2026-02-01T00:00:00.000Z'));

      const response = await fetch(`${baseUrl}/documents`);
      const data = await response.json();

      expect(data.total).toBe(3);
      expect(data.documents.map((document: { name: string }) => document.name)).toEqual([
        'newest.txt',
        'middle.txt',
        'oldest.txt',
      ]);
    });

    it('should ignore the query string', async () => {
      const response = await fetch(`${baseUrl}/documents?limit=10`);

      expect(response.status).toBe(200);
      expect((await response.json()).total).toBe(0);
    });

    it('should not expose the extracted text', async () => {
      await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents`);
      const data = await response.json();

      expect(data.documents[0].processingResult).toBeDefined();
      expect(data.documents[0].processingResult).not.toHaveProperty('extractedText');
      expect(data.documents[0]).not.toHaveProperty('extractedText');
    });
  });

  describe('GET /documents/:id/status', () => {
    it('should return 404 for an unknown document', async () => {
      const response = await fetch(`${baseUrl}/documents/unknown/status`);

      expect(response.status).toBe(404);
      expect((await response.json()).error).toBe('Not Found');
    });

    it('should return pending for a new document', async () => {
      const document = await documentService.createDocument({ name: 'new.pdf' });

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: document.id,
        status: 'pending',
        createdAt: document.createdAt.toISOString(),
      });
    });

    it('should return completed without the processing result', async () => {
      const document = await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);
      const data = await response.json();

      expect(data.status).toBe('completed');
      expect(data).not.toHaveProperty('processingResult');
    });

    it('should return failed with the error message', async () => {
      const document = await documentService.createDocument({ name: 'broken.pdf' });
      await documentService.updateDocumentStatus(document.id, 'failed', 'Extraction failed');

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);
      const data = await response.json();

      expect(data.status).toBe('failed');
      expect(data.error).toBe('Extraction failed');
    });
  });

  describe('GET /documents/:id/text', () => {
    it('should return 404 for an unknown document', async () => {
      const response = await fetch(`${baseUrl}/documents/unknown/text`);

      expect(response.status).toBe(404);
    });

    it('should return 409 while the document is processing', async () => {
      const document = await documentService.createDocument({ name: 'busy.pdf' });
      await documentService.updateDocumentStatus(document.id, 'processing');

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toContain('processing');
    });

    it('should return 409 when processing failed', async () => {
      const document = await documentService.createDocument({ name: 'broken.pdf' });
      await documentService.updateDocumentStatus(document.id, 'failed', 'Extraction failed');

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe('Extraction failed');
    });

    it('should return 404 when the document has no extracted text', async () => {
      // Word documents are not text-extracted
      const document = await documentService.createDocument({ name: 'letter.docx' });
      await documentService.updateDocumentResult(document.id, {
        wordCount: 3,
        pageEstimated: 1,
        processingDuration: 5,
        processedAt: new Date(),
      });

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(404);
    });

    it('should return the extracted text', async () => {
      const document = await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: document.id,
        text: 'Hello from the PDF',
        numpages: 1,
        extractedAt: '2026-02-01T10:00:00.000Z',
      });
    });

    it('should return an empty string for a PDF without a text layer', async () => {
      const document = await documentService.createDocument({ name: 'scan.pdf' });
      await documentService.updateDocumentResult(document.id, {
        wordCount: 0,
        pageEstimated: 1,
        processingDuration: 5,
        processedAt: new Date(),
        extractedText: '',
        numpages: 1,
      });

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(200);
      expect((await response.json()).text).toBe('');
    });
  });

  describe('DELETE /documents/:id', () => {
    it('should return 404 for an unknown document', async () => {
      const response = await fetch(`${baseUrl}/documents/unknown`, { method: 'DELETE' });

      expect(response.status).toBe(404);
    });

    it('should delete the document and its S3 objects', async () => {
      const document = await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(response.status).toBe(204);
      expect(deletedKeys()).toEqual([S3_KEY, EXTRACTED_KEY]);
      expect(await documentService.getDocument(document.id)).toBeUndefined();

      const after = await fetch(`${baseUrl}/documents/${document.id}`);
      expect(after.status).toBe(404);
    });

    it('should return 404 on a second delete', async () => {
      const document = await seedCompletedDocument();
      await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      const second = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(second.status).toBe(404);
    });

    it('should delete a document without S3 location', async () => {
      const document = await documentService.createDocument({ name: 'local.txt' });

      const response = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(response.status).toBe(204);
      expect(deletedKeys()).toEqual([]);
      expect(await documentService.getDocument(document.id)).toBeUndefined();
    });

    it('should keep the document when S3 deletion fails', async () => {
      const document = await seedCompletedDocument();
      vi.mocked(s3Client.send).mockRejectedValueOnce(new Error('S3 unavailable'));

      const response = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(response.status).toBe(500);
      expect(await documentService.getDocument(document.id)).toBeDefined();
    });
  });

  describe('Routing', () => {
    it('should not let /documents/:id swallow /documents/:id/status', async () => {
      const document = await documentService.createDocument({ name: 'routing.pdf' });

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);
      const data = await response.json();

      expect(data.status).toBe('pending');
      expect(data).not.toHaveProperty('name');
    });

    it('should return 400 when the ID is empty', async () => {
      const response = await fetch(`${baseUrl}/documents/`);

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('Bad Request');
    });
  });
});
