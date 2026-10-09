/**
 * Everything that touches the `documents` table.
 *
 * The service above it holds the business rules; this holds the SQL. Each method
 * runs one parameterized statement and turns the row it gets back into a
 * `Document`, so no column name escapes this file. Statements that encode a rule
 * — the COALESCE that preserves a previous error, the atomic status change in
 * `updateResult` — are deliberately left as they were: they are the behaviour,
 * not an implementation detail.
 */

import type { Pool } from 'pg';
import { assertTestDatabase, databasePool } from '../db.js';
import type { CreateDocumentRequest, Document, ProcessingResult } from '../types/document.js';

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
 * The columns `create` writes. Everything except the id is optional, mirroring
 * what the HTTP layer may or may not know about the file at that point.
 */
export type NewDocument = CreateDocumentRequest & { id: string };

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

export class DocumentRepository {
  /**
   * The pool defaults to the shared one. Passing a different pool is what lets a
   * test read the same rows through an independent set of connections, which is
   * how "the data really is in the database" gets proved.
   */
  constructor(private readonly pool: Pool = databasePool) {}

  /**
   * Insert a new document, in the `pending` state.
   */
  async create(document: NewDocument): Promise<Document> {
    // RETURNING * so the timestamps in the result are the ones the database
    // actually stored, not values guessed on this side.
    const { rows } = await this.pool.query<DocumentRow>(
      `INSERT INTO documents (id, name, status, s3_bucket, s3_key, size, mimetype)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6)
       RETURNING *`,
      [
        document.id,
        document.name,
        document.s3Bucket ?? null,
        document.s3Key ?? null,
        document.size ?? null,
        document.mimetype ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error('The database did not return the inserted document');
    }
    return rowToDocument(row);
  }

  /**
   * Find one document by ID, or undefined when there is no such row.
   */
  async findById(id: string): Promise<Document | undefined> {
    const { rows } = await this.pool.query<DocumentRow>('SELECT * FROM documents WHERE id = $1', [
      id,
    ]);

    const row = rows[0];
    return row ? rowToDocument(row) : undefined;
  }

  /**
   * Every document, most recent first.
   */
  async findAll(): Promise<Document[]> {
    const { rows } = await this.pool.query<DocumentRow>(
      'SELECT * FROM documents ORDER BY created_at DESC, id DESC',
    );

    return rows.map(rowToDocument);
  }

  /**
   * Change a document's status, and optionally record why. Returns false when
   * the ID matches nothing — the caller's only signal that the row is gone.
   */
  async updateStatus(id: string, status: Document['status'], error?: string): Promise<boolean> {
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
   * Store a processing result. The status change to 'completed' is part of the
   * same statement on purpose: a result and the status it implies are one fact.
   */
  async updateResult(id: string, result: ProcessingResult): Promise<boolean> {
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
   * Delete one document. Returns false when the ID matches nothing.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Clear all documents (useful for testing)
   *
   * There is no WHERE clause to get wrong here, so the guard is what stands
   * between a mistyped DATABASE_URL and a wiped development database. It sits
   * here rather than in the caller so that no caller can forget it.
   */
  async clear(): Promise<void> {
    assertTestDatabase();
    await this.pool.query('DELETE FROM documents');
  }
}
