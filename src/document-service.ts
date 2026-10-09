/**
 * Document Service
 * Handles document storage and management
 *
 * Records live in PostgreSQL; the file bytes stay in S3 (`s3Bucket` / `s3Key`).
 * Every method that touches the database returns a Promise — unlike the Map this
 * replaces, there is no longer a synchronous read.
 */

import type { Pool } from 'pg';
import { assertTestDatabase, databasePool } from './db.js';
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

/** A `documents` row as node-postgres returns it. */
interface DocumentRow {
  id: string;
  name: string;
  status: Document['status'];
  s3_bucket: string | null;
  s3_key: string | null;
  size: number | null;
  mimetype: string | null;
  error: string | null;
  processing_result: StoredProcessingResult | null;
  created_at: Date;
  updated_at: Date;
}

/** ProcessingResult as it sits in JSONB, where processedAt is an ISO string. */
interface StoredProcessingResult {
  wordCount: number;
  pageEstimated: number;
  processingDuration: number;
  processedAt: string;
  extractedText?: string;
  numpages?: number;
}

/**
 * Turn a row into the business object.
 *
 * Two conversions are deliberate. The database says "no value" with NULL while
 * the business object says it with an absent property, so every nullable column
 * becomes undefined — without that, a response would carry `"size": null`
 * instead of omitting the key, which the client's `size?: number` does not
 * expect. And `processedAt` is a Date here but an ISO string in JSONB, so it is
 * parsed back.
 */
function rowToDocument(row: DocumentRow): Document {
  const document: Document = {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    s3Bucket: row.s3_bucket ?? undefined,
    s3Key: row.s3_key ?? undefined,
    size: row.size ?? undefined,
    mimetype: row.mimetype ?? undefined,
    error: row.error ?? undefined,
  };

  if (row.processing_result) {
    const stored = row.processing_result;
    document.processingResult = {
      wordCount: stored.wordCount,
      pageEstimated: stored.pageEstimated,
      processingDuration: stored.processingDuration,
      processedAt: new Date(stored.processedAt),
      extractedText: stored.extractedText,
      numpages: stored.numpages,
    };
  }

  return document;
}

/** The mirror of the conversion above, on the way into JSONB. */
function toStoredProcessingResult(result: ProcessingResult): StoredProcessingResult {
  return {
    wordCount: result.wordCount,
    pageEstimated: result.pageEstimated,
    processingDuration: result.processingDuration,
    processedAt: result.processedAt.toISOString(),
    extractedText: result.extractedText,
    numpages: result.numpages,
  };
}

/**
 * Document service class
 */
export class DocumentService {
  /**
   * The pool defaults to the shared one. Passing a different pool is what lets a
   * test read the same rows through an independent set of connections, which is
   * how "the data really is in the database" gets proved.
   */
  constructor(private readonly pool: Pool = databasePool) {}

  /**
   * Create a new document
   */
  async createDocument(request: CreateDocumentRequest): Promise<Document> {
    // RETURNING * so the timestamps in the result are the ones the database
    // actually stored, not values guessed on this side.
    const { rows } = await this.pool.query<DocumentRow>(
      `INSERT INTO documents (id, name, status, s3_bucket, s3_key, size, mimetype)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6)
       RETURNING *`,
      [
        createId(),
        request.name.trim(),
        request.s3Bucket ?? null,
        request.s3Key ?? null,
        request.size ?? null,
        request.mimetype ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error('The database did not return the inserted document');
    }
    return rowToDocument(row);
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<Document | undefined> {
    const { rows } = await this.pool.query<DocumentRow>('SELECT * FROM documents WHERE id = $1', [
      id,
    ]);

    const row = rows[0];
    return row ? rowToDocument(row) : undefined;
  }

  /**
   * Get all documents, most recent first
   */
  async getAllDocuments(): Promise<Document[]> {
    const { rows } = await this.pool.query<DocumentRow>(
      'SELECT * FROM documents ORDER BY created_at DESC, id DESC',
    );

    return rows.map(rowToDocument);
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(
    id: string,
    status: Document['status'],
    error?: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE documents
          SET status = $2,
              -- Both NULL and '' mean "no error supplied", which is what the
              -- previous truthiness check did. COALESCE then keeps the message
              -- already stored instead of erasing it.
              error = COALESCE(NULLIF($3, ''), error),
              updated_at = now()
        WHERE id = $1`,
      [id, status, error ?? null],
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Update document with processing result
   */
  async updateDocumentResult(id: string, result: ProcessingResult): Promise<boolean> {
    const update = await this.pool.query(
      `UPDATE documents
          SET status = 'completed',
              processing_result = $2,
              updated_at = now()
        WHERE id = $1`,
      [id, toStoredProcessingResult(result)],
    );

    return (update.rowCount ?? 0) > 0;
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Clear all documents (useful for testing)
   *
   * There is no WHERE clause to get wrong here, so the guard is what stands
   * between a mistyped DATABASE_URL and a wiped development database.
   */
  async clearDocuments(): Promise<void> {
    assertTestDatabase();
    await this.pool.query('DELETE FROM documents');
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
