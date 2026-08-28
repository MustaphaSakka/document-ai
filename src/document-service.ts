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

export interface ValidationError {
  error: string;
  message: string;
}

/**
 * Validate document creation request
 */
export function validateCreateRequest(data: unknown): ValidationError | null {
  // Check if data is an object
  if (typeof data !== 'object' || data === null) {
    return {
      error: 'Invalid Request',
      message: 'Request body must be a JSON object',
    };
  }

  const request = data as CreateDocumentRequest;

  // Check if name field exists
  if (!('name' in request)) {
    return {
      error: 'Validation Error',
      message: 'Missing required field: name',
    };
  }

  // Validate name is a string
  if (typeof request.name !== 'string') {
    return {
      error: 'Validation Error',
      message: 'Field "name" must be a string',
    };
  }

  // Validate name is not empty
  if (request.name.trim().length === 0) {
    return {
      error: 'Validation Error',
      message: 'Field "name" cannot be empty',
    };
  }

  return null;
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
