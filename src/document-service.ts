/**
 * Document Service
 * Handles document storage and management
 */

import { createId } from './utils.js';

export interface Document {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  s3Bucket?: string;
  s3Key?: string;
  size?: number;
  mimetype?: string;
  processingResult?: ProcessingResult;
  error?: string;
}

export interface ProcessingResult {
  wordCount: number;
  pageEstimated: number;
  processingDuration: number; // in milliseconds
  processedAt: Date;
  extractedText?: string;
  numpages?: number;
}

export interface CreateDocumentRequest {
  name: string;
  s3Bucket?: string;
  s3Key?: string;
  size?: number;
  mimetype?: string;
}

/**
 * Document service class
 */
export class DocumentService {
  private documents: Map<string, Document>;

  constructor() {
    this.documents = new Map();
  }

  /**
   * Create a new document
   */
  createDocument(request: CreateDocumentRequest): Document {
    const id = createId();
    const document: Document = {
      id,
      name: request.name.trim(),
      status: 'pending',
      createdAt: new Date(),
      s3Bucket: request.s3Bucket,
      s3Key: request.s3Key,
      size: request.size,
      mimetype: request.mimetype,
    };

    this.documents.set(id, document);
    return document;
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  /**
   * Update document status
   */
  updateDocumentStatus(id: string, status: Document['status'], error?: string): boolean {
    const document = this.documents.get(id);
    if (!document) {
      return false;
    }

    document.status = status;
    if (error) {
      document.error = error;
    }
    return true;
  }

  /**
   * Update document with processing result
   */
  updateDocumentResult(id: string, result: ProcessingResult): boolean {
    const document = this.documents.get(id);
    if (!document) {
      return false;
    }

    document.status = 'completed';
    document.processingResult = result;
    return true;
  }

  /**
   * Delete a document by ID
   */
  deleteDocument(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Clear all documents (useful for testing)
   */
  clearDocuments(): void {
    this.documents.clear();
  }

  /**
   * Get extracted text result key for a document
   */
  getExtractedTextKey(documentId: string): string | null {
    const document = this.documents.get(documentId);
    if (!document || !document.s3Key) {
      return null;
    }

    // Extract document ID from S3 key (documents/{uuid}.pdf -> {uuid})
    const match = document.s3Key.match(/^documents\/([a-z0-9-]+)\.pdf$/i);
    if (!match) {
      return null;
    }

    return `documents/${match[1]}-extracted.json`;
  }
}

// Singleton instance
export const documentService = new DocumentService();
