/**
 * Document Service
 * Handles document storage and management
 *
 * Business rules only: the shape of an id, the normalisation of a name, and
 * where the extracted text of a PDF lives in S3. Every statement that touches
 * PostgreSQL belongs to `DocumentRepository`, so there is no SQL here and this
 * file knows no column name.
 *
 * Records live in PostgreSQL; the file bytes stay in S3 (`s3Bucket` / `s3Key`).
 * Every method that reaches the database returns a Promise — unlike the Map this
 * replaces, there is no longer a synchronous read.
 */

import { createId } from './utils.js';
import { DocumentRepository } from './repositories/document-repository.js';
import type { CreateDocumentRequest, Document, ProcessingResult } from './types/document.js';

// Re-exported so that the modules already importing these types from this file
// (the HTTP layer and the processor) keep working unchanged.
export type { CreateDocumentRequest, Document, ProcessingResult };

/**
 * Document service class
 */
export class DocumentService {
  /**
   * The repository defaults to one backed by the shared pool. Passing a
   * different one is what lets a test read the same rows through an independent
   * set of connections, which is how "the data really is in the database" gets
   * proved.
   */
  constructor(private readonly repository: DocumentRepository = new DocumentRepository()) {}

  /**
   * Create a new document
   */
  async createDocument(request: CreateDocumentRequest): Promise<Document> {
    return this.repository.create({
      id: createId(),
      name: request.name.trim(),
      s3Bucket: request.s3Bucket,
      s3Key: request.s3Key,
      size: request.size,
      mimetype: request.mimetype,
    });
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<Document | undefined> {
    return this.repository.findById(id);
  }

  /**
   * Get all documents, most recent first
   */
  async getAllDocuments(): Promise<Document[]> {
    // Already ordered by the query: created_at DESC, id DESC.
    return this.repository.findAll();
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(
    id: string,
    status: Document['status'],
    error?: string,
  ): Promise<boolean> {
    return this.repository.updateStatus(id, status, error);
  }

  /**
   * Update document with processing result
   */
  async updateDocumentResult(id: string, result: ProcessingResult): Promise<boolean> {
    return this.repository.updateResult(id, result);
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /**
   * Clear all documents (useful for testing)
   *
   * The `_test` guard that makes this safe lives in the repository, so a caller
   * cannot reach the DELETE without passing it.
   */
  async clearDocuments(): Promise<void> {
    await this.repository.clear();
  }

  /**
   * Where the extracted text of a PDF is stored in S3, derived from the file's
   * own key. Pure, and therefore synchronous: the caller already holds the
   * document, so looking it up again would be a wasted round trip.
   */
  getExtractedTextKey(s3Key: string | undefined): string | null {
    if (!s3Key) {
      return null;
    }

    // documents/{uuid}.pdf -> documents/{uuid}-extracted.json
    const match = /^documents\/([a-z0-9-]+)\.pdf$/i.exec(s3Key);
    const uuid = match?.[1];
    if (!uuid) {
      return null;
    }

    return `documents/${uuid}-extracted.json`;
  }
}

// Singleton instance
export const documentService = new DocumentService();
