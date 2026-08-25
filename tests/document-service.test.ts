/**
 * Tests for document service functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { documentService } from '../src/document-service';
import { resetIdCounter } from '../src/utils';

describe('Document Service', () => {
  beforeEach(() => {
    documentService.clearDocuments();
    resetIdCounter();
  });

  describe('createDocument', () => {
    it('should create document with basic data', () => {
      const document = documentService.createDocument({
        name: 'document.pdf',
      });

      expect(document.id).toBeDefined();
      expect(document.name).toBe('document.pdf');
      expect(document.status).toBe('pending');
      expect(document.createdAt).toBeInstanceOf(Date);
    });

    it('should create document with S3 information', () => {
      const document = documentService.createDocument({
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

    it('should trim whitespace from name', () => {
      const document = documentService.createDocument({
        name: '  document.pdf  ',
      });

      expect(document.name).toBe('document.pdf');
    });

    it('should generate unique IDs', () => {
      const doc1 = documentService.createDocument({ name: 'doc1.pdf' });
      const doc2 = documentService.createDocument({ name: 'doc2.pdf' });
      const doc3 = documentService.createDocument({ name: 'doc3.pdf' });

      expect(doc1.id).not.toBe(doc2.id);
      expect(doc2.id).not.toBe(doc3.id);
      expect(doc3.id).not.toBe(doc1.id);
    });

    it('should store documents correctly', () => {
      const doc1 = documentService.createDocument({ name: 'test.pdf' });
      const retrieved = documentService.getDocument(doc1.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(doc1.id);
      expect(retrieved?.name).toBe(doc1.name);
    });

    it('should return all documents', () => {
      documentService.createDocument({ name: 'doc1.pdf' });
      documentService.createDocument({ name: 'doc2.pdf' });

      const allDocs = documentService.getAllDocuments();
      expect(allDocs).toHaveLength(2);
    });
  });

  describe('getDocument', () => {
    it('should return undefined for non-existent document', () => {
      const result = documentService.getDocument('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return existing document', () => {
      const created = documentService.createDocument({ name: 'test.pdf' });
      const retrieved = documentService.getDocument(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return document with file information', () => {
      const created = documentService.createDocument({
        name: 'file.pdf',
        s3Bucket: 'my-bucket',
        s3Key: 'uuid.pdf',
        size: 2048,
        mimetype: 'application/pdf',
      });

      const retrieved = documentService.getDocument(created.id);

      expect(retrieved?.s3Bucket).toBe('my-bucket');
      expect(retrieved?.s3Key).toBe('uuid.pdf');
      expect(retrieved?.size).toBe(2048);
      expect(retrieved?.mimetype).toBe('application/pdf');
    });
  });

  describe('clearDocuments', () => {
    it('should clear all documents', () => {
      documentService.createDocument({ name: 'doc1.pdf' });
      documentService.createDocument({ name: 'doc2.pdf' });

      expect(documentService.getAllDocuments()).toHaveLength(2);

      documentService.clearDocuments();
      expect(documentService.getAllDocuments()).toHaveLength(0);
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
