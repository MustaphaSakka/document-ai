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
}

export interface CreateDocumentRequest {
  name: string;
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
   * Clear all documents (useful for testing)
   */
  clearDocuments(): void {
    this.documents.clear();
  }
}

// Singleton instance
export const documentService = new DocumentService();
