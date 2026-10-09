/**
 * Tests for document service functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { documentService } from '../src/document-service.js';
import { resetIdCounter } from '../src/utils.js';

describe('Document Service', () => {
  beforeEach(async () => {
    // Empties the documents table. The service refuses to do this on a database
    // whose name does not end with _test.
    await documentService.clearDocuments();
    resetIdCounter();
  });

  describe('createDocument', () => {
    it('should create document with basic data', async () => {
      const document = await documentService.createDocument({
        name: 'document.pdf',
      });

      expect(document.id).toBeDefined();
      expect(document.name).toBe('document.pdf');
      expect(document.status).toBe('pending');
      expect(document.createdAt).toBeInstanceOf(Date);
    });

    it('should create document with S3 information', async () => {
      const document = await documentService.createDocument({
        name: 'invoice.pdf',
        s3Bucket: 'my-bucket',
        s3Key: 'abc123.pdf',
        size: 1024,
        mimetype: 'application/pdf',
      });

      expect(document.name).toBe('invoice.pdf');
      expect(document.s3Bucket).toBe('my-bucket');
      expect(document.s3Key).toBe('abc123.pdf');
      expect(document.size).toBe(1024);
      expect(document.mimetype).toBe('application/pdf');
    });

    it('should trim whitespace from name', async () => {
      const document = await documentService.createDocument({
        name: '  document.pdf  ',
      });

      expect(document.name).toBe('document.pdf');
    });

    it('should generate unique IDs', async () => {
      const doc1 = await documentService.createDocument({ name: 'doc1.pdf' });
      const doc2 = await documentService.createDocument({ name: 'doc2.pdf' });
      const doc3 = await documentService.createDocument({ name: 'doc3.pdf' });

      expect(doc1.id).not.toBe(doc2.id);
      expect(doc2.id).not.toBe(doc3.id);
      expect(doc3.id).not.toBe(doc1.id);
    });

    it('should store documents correctly', async () => {
      const doc1 = await documentService.createDocument({ name: 'test.pdf' });
      const retrieved = await documentService.getDocument(doc1.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(doc1.id);
      expect(retrieved?.name).toBe(doc1.name);
    });

    it('should store every document it is given', async () => {
      await documentService.createDocument({ name: 'doc1.pdf' });
      await documentService.createDocument({ name: 'doc2.pdf' });

      const page = await documentService.getDocuments({ page: 1, limit: 20 });
      expect(page.total).toBe(2);
    });

    it('should leave the columns that were not provided empty', async () => {
      const created = await documentService.createDocument({ name: 'bare.pdf' });

      // The columns are NULL in PostgreSQL; the document exposes them as
      // undefined, which is what the rest of the code and the API expect.
      expect(created.s3Bucket).toBeUndefined();
      expect(created.s3Key).toBeUndefined();
      expect(created.size).toBeUndefined();
      expect(created.mimetype).toBeUndefined();
      expect(created.error).toBeUndefined();
      expect(created.processingResult).toBeUndefined();
    });
  });

  describe('getDocument', () => {
    it('should return undefined for non-existent document', async () => {
      const result = await documentService.getDocument('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return existing document', async () => {
      const created = await documentService.createDocument({ name: 'test.pdf' });
      const retrieved = await documentService.getDocument(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return document with file information', async () => {
      const created = await documentService.createDocument({
        name: 'file.pdf',
        s3Bucket: 'my-bucket',
        s3Key: 'uuid.pdf',
        size: 2048,
        mimetype: 'application/pdf',
      });

      const retrieved = await documentService.getDocument(created.id);

      expect(retrieved?.s3Bucket).toBe('my-bucket');
      expect(retrieved?.s3Key).toBe('uuid.pdf');
      expect(retrieved?.size).toBe(2048);
      expect(retrieved?.mimetype).toBe('application/pdf');
    });
  });

  describe('getDocuments', () => {
    it('should return an empty page when there is no document', async () => {
      expect(await documentService.getDocuments({ page: 1, limit: 20 })).toEqual({
        documents: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it('should return the most recent document first', async () => {
      await documentService.createDocument({ name: 'first.pdf' });
      await documentService.createDocument({ name: 'second.pdf' });

      const { documents } = await documentService.getDocuments({ page: 1, limit: 20 });

      expect(documents.map((doc) => doc.name)).toEqual(['second.pdf', 'first.pdf']);
    });

    it('should round the page count up', async () => {
      await documentService.createDocument({ name: 'one.pdf' });
      await documentService.createDocument({ name: 'two.pdf' });
      await documentService.createDocument({ name: 'three.pdf' });

      // Three documents of two per page need two pages, the second one short.
      const page = await documentService.getDocuments({ page: 1, limit: 2 });

      expect(page.totalPages).toBe(2);
      expect(page.documents).toHaveLength(2);
    });

    it('should offset the page by the pages before it', async () => {
      for (const name of ['one.pdf', 'two.pdf', 'three.pdf']) {
        await documentService.createDocument({ name });
      }

      // Most recent first, so page 2 of two-per-page starts at the oldest.
      const second = await documentService.getDocuments({ page: 2, limit: 2 });

      expect(second.documents.map((doc) => doc.name)).toEqual(['one.pdf']);
      expect(second.page).toBe(2);
    });

    it('should report the total number of documents on every page', async () => {
      for (const name of ['one.pdf', 'two.pdf', 'three.pdf']) {
        await documentService.createDocument({ name });
      }

      for (const page of [1, 2, 3]) {
        expect((await documentService.getDocuments({ page, limit: 1 })).total).toBe(3);
      }
    });

    it('should return an empty page past the end without losing the total', async () => {
      await documentService.createDocument({ name: 'only.pdf' });

      const page = await documentService.getDocuments({ page: 9, limit: 20 });

      expect(page.documents).toEqual([]);
      expect(page.total).toBe(1);
      expect(page.totalPages).toBe(1);
    });
  });

  describe('updateDocumentStatus', () => {
    it('should change the status', async () => {
      const document = await documentService.createDocument({ name: 'doc.pdf' });

      expect(await documentService.updateDocumentStatus(document.id, 'processing')).toBe(true);

      const retrieved = await documentService.getDocument(document.id);
      expect(retrieved?.status).toBe('processing');
    });

    it('should return false for an unknown document', async () => {
      expect(await documentService.updateDocumentStatus('unknown', 'processing')).toBe(false);
    });

    it('should record the error message', async () => {
      const document = await documentService.createDocument({ name: 'doc.pdf' });

      await documentService.updateDocumentStatus(document.id, 'failed', 'Extraction failed');

      const retrieved = await documentService.getDocument(document.id);
      expect(retrieved?.status).toBe('failed');
      expect(retrieved?.error).toBe('Extraction failed');
    });

    it('should keep the previous error when none is supplied', async () => {
      const document = await documentService.createDocument({ name: 'doc.pdf' });
      await documentService.updateDocumentStatus(document.id, 'failed', 'Extraction failed');

      await documentService.updateDocumentStatus(document.id, 'processing');

      const retrieved = await documentService.getDocument(document.id);
      expect(retrieved?.status).toBe('processing');
      expect(retrieved?.error).toBe('Extraction failed');
    });

    it('should treat an empty message as no message', async () => {
      const document = await documentService.createDocument({ name: 'doc.pdf' });
      await documentService.updateDocumentStatus(document.id, 'failed', 'Extraction failed');

      await documentService.updateDocumentStatus(document.id, 'failed', '');

      const retrieved = await documentService.getDocument(document.id);
      expect(retrieved?.error).toBe('Extraction failed');
    });
  });

  describe('updateDocumentResult', () => {
    const result = {
      wordCount: 12,
      pageEstimated: 2,
      processingDuration: 34,
      processedAt: new Date('2026-04-01T08:30:00.000Z'),
      extractedText: 'Accents é à ü, "quotes" and a \\ backslash',
      numpages: 2,
    };

    it('should mark the document completed and store the result', async () => {
      const document = await documentService.createDocument({ name: 'doc.pdf' });

      expect(await documentService.updateDocumentResult(document.id, result)).toBe(true);

      const retrieved = await documentService.getDocument(document.id);
      expect(retrieved?.status).toBe('completed');
      // JSONB has no date type: processedAt is stored as a string and has to be
      // turned back into a Date, which this asserts.
      expect(retrieved?.processingResult?.processedAt).toBeInstanceOf(Date);
      expect(retrieved?.processingResult).toEqual(result);
    });

    it('should return false for an unknown document', async () => {
      expect(await documentService.updateDocumentResult('unknown', result)).toBe(false);
    });

    it('should not invent a result when none was stored', async () => {
      const document = await documentService.createDocument({ name: 'doc.pdf' });

      const retrieved = await documentService.getDocument(document.id);
      expect(retrieved?.processingResult).toBeUndefined();
    });
  });

  describe('getExtractedTextKey', () => {
    it('should derive the extracted-text key from a PDF key', () => {
      expect(documentService.getExtractedTextKey('documents/abc-123.pdf')).toBe(
        'documents/abc-123-extracted.json',
      );
    });

    it('should return null without a key', () => {
      expect(documentService.getExtractedTextKey(undefined)).toBeNull();
    });

    it('should return null for a key that is not a stored PDF', () => {
      expect(documentService.getExtractedTextKey('other/abc.pdf')).toBeNull();
      expect(documentService.getExtractedTextKey('documents/abc.txt')).toBeNull();
    });
  });

  describe('clearDocuments', () => {
    it('should clear all documents', async () => {
      await documentService.createDocument({ name: 'doc1.pdf' });
      await documentService.createDocument({ name: 'doc2.pdf' });

      expect((await documentService.getDocuments({ page: 1, limit: 20 })).total).toBe(2);

      await documentService.clearDocuments();
      expect((await documentService.getDocuments({ page: 1, limit: 20 })).total).toBe(0);
    });
  });

  describe('deleteDocument', () => {
    it('should delete an existing document', async () => {
      const document = await documentService.createDocument({ name: 'doc.pdf' });

      expect(await documentService.deleteDocument(document.id)).toBe(true);
      expect(await documentService.getDocument(document.id)).toBeUndefined();
      expect((await documentService.getDocuments({ page: 1, limit: 20 })).total).toBe(0);
    });

    it('should return false for an unknown document', async () => {
      expect(await documentService.deleteDocument('unknown')).toBe(false);
    });

    it('should only delete the requested document', async () => {
      const first = await documentService.createDocument({ name: 'first.pdf' });
      const second = await documentService.createDocument({ name: 'second.pdf' });

      await documentService.deleteDocument(first.id);

      expect(await documentService.getDocument(first.id)).toBeUndefined();
      expect(await documentService.getDocument(second.id)).toBeDefined();
    });
  });

  describe('Configuration validation', () => {
    it('should load S3 client with test environment variables', async () => {
      // This test verifies that the S3 client loads successfully
      // with the environment variables provided by vitest.config.ts
      const s3Module = await import('../src/s3-client.js');

      expect(s3Module.s3Client).toBeDefined();
      expect(s3Module.BUCKET_NAME).toBe('test-bucket');
    });
  });
});
