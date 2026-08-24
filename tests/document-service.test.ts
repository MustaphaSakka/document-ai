/**
 * Tests for document submission functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { documentService, validateCreateRequest, type CreateDocumentRequest } from '../src/document-service';
import { resetIdCounter } from '../src/utils';

describe('Document Service', () => {
  beforeEach(() => {
    documentService.clearDocuments();
    resetIdCounter();
  });

  describe('validateCreateRequest', () => {
    it('should accept valid request', () => {
      const data: CreateDocumentRequest = { name: 'document.pdf' };
      const result = validateCreateRequest(data);
      expect(result).toBeNull();
    });

    it('should reject non-object data', () => {
      expect(validateCreateRequest(null)).not.toBeNull();
      expect(validateCreateRequest(undefined)).not.toBeNull();
      expect(validateCreateRequest('string')).not.toBeNull();
      expect(validateCreateRequest(123)).not.toBeNull();
      expect(validateCreateRequest([])).not.toBeNull();
    });

    it('should reject request without name field', () => {
      const result = validateCreateRequest({});
      expect(result).not.toBeNull();
      expect(result?.error).toBe('Validation Error');
      expect(result?.message).toContain('name');
    });

    it('should reject request with non-string name', () => {
      expect(validateCreateRequest({ name: 123 })).not.toBeNull();
      expect(validateCreateRequest({ name: {} })).not.toBeNull();
      expect(validateCreateRequest({ name: [] })).not.toBeNull();
      expect(validateCreateRequest({ name: null })).not.toBeNull();
    });

    it('should reject request with empty name', () => {
      const result = validateCreateRequest({ name: '   ' });
      expect(result).not.toBeNull();
      expect(result?.error).toBe('Validation Error');
      expect(result?.message).toContain('empty');
    });

    it('should accept name with leading/trailing whitespace', () => {
      const data: CreateDocumentRequest = { name: '  document.pdf  ' };
      const result = validateCreateRequest(data);
      expect(result).toBeNull();
    });
  });

  describe('createDocument', () => {
    it('should create document with valid data', () => {
      const request: CreateDocumentRequest = { name: 'invoice.pdf' };
      const document = documentService.createDocument(request);

      expect(document.id).toBeDefined();
      expect(document.name).toBe('invoice.pdf');
      expect(document.status).toBe('pending');
      expect(document.createdAt).toBeInstanceOf(Date);
    });

    it('should trim whitespace from name', () => {
      const request: CreateDocumentRequest = { name: '  document.pdf  ' };
      const document = documentService.createDocument(request);

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
});
