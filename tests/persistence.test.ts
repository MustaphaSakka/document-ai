/**
 * Persistence tests: these exist to show that a document's state lives in
 * PostgreSQL and not inside DocumentService.
 *
 * Every read here goes through a second connection pool and a second
 * DocumentService instance, neither of which the application's service has ever
 * seen. With the old in-memory Map these tests could not pass: a fresh instance
 * would have started out empty.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { DocumentService, documentService } from '../src/document-service.js';
import { DocumentRepository } from '../src/repositories/document-repository.js';
import { TEST_DATABASE_URL } from './config.js';

describe('PostgreSQL persistence', () => {
  let otherPool: Pool;
  let otherService: DocumentService;

  beforeEach(async () => {
    await documentService.clearDocuments();

    // A separate pool: separate connections, separate client state.
    otherPool = new Pool({ connectionString: TEST_DATABASE_URL });
    otherService = new DocumentService(new DocumentRepository(otherPool));
  });

  afterEach(async () => {
    await otherPool.end();
  });

  it('should store a document another connection can read', async () => {
    const created = await documentService.createDocument({
      name: 'shared.pdf',
      s3Bucket: 'test-bucket',
      s3Key: 'documents/shared.pdf',
      size: 512,
      mimetype: 'application/pdf',
    });

    const readElsewhere = await otherService.getDocument(created.id);

    expect(readElsewhere).toEqual(created);
  });

  it('should list a document from an instance that never created it', async () => {
    const created = await documentService.createDocument({ name: 'durable.pdf' });

    const fromOtherInstance = await otherService.getDocuments({ page: 1, limit: 20 });

    expect(fromOtherInstance.documents.map((document) => document.id)).toEqual([created.id]);
  });

  it('should expose a status written through another connection', async () => {
    const created = await documentService.createDocument({ name: 'status.pdf' });

    await otherService.updateDocumentStatus(created.id, 'processing');

    expect((await documentService.getDocument(created.id))?.status).toBe('processing');
  });

  it('should expose a processing result written through another connection', async () => {
    const created = await documentService.createDocument({ name: 'result.pdf' });
    const result = {
      wordCount: 7,
      pageEstimated: 1,
      processingDuration: 3,
      processedAt: new Date('2026-05-05T12:00:00.000Z'),
      extractedText: 'text written by the other connection',
    };

    await otherService.updateDocumentResult(created.id, result);

    const document = await documentService.getDocument(created.id);
    expect(document?.status).toBe('completed');
    // Survives a round trip through a different connection, JSONB included.
    expect(document?.processingResult).toEqual(result);
    expect(document?.processingResult?.processedAt).toBeInstanceOf(Date);
  });

  it('should really delete the row', async () => {
    const created = await documentService.createDocument({ name: 'gone.pdf' });

    await documentService.deleteDocument(created.id);

    const { rows } = await otherPool.query('SELECT id FROM documents WHERE id = $1', [created.id]);
    expect(rows).toHaveLength(0);
  });

  it('should write the columns the table declares', async () => {
    const created = await documentService.createDocument({
      name: 'columns.pdf',
      size: 128,
      mimetype: 'application/pdf',
    });

    // Reads the raw row, so this checks the SQL that was written rather than
    // the mapping the service applies on the way out.
    const { rows } = await otherPool.query<{
      status: string;
      s3_key: string | null;
      s3_bucket: string | null;
      error: string | null;
      processing_result: unknown;
      created_at: Date;
    }>(
      `SELECT status, s3_key, s3_bucket, error, processing_result, created_at
         FROM documents
        WHERE id = $1`,
      [created.id],
    );

    const row = rows[0];
    expect(row?.status).toBe('pending');
    expect(row?.s3_key).toBeNull();
    expect(row?.s3_bucket).toBeNull();
    expect(row?.error).toBeNull();
    expect(row?.processing_result).toBeNull();
    expect(row?.created_at).toBeInstanceOf(Date);
  });

  it('should refuse a status the table does not allow', async () => {
    const created = await documentService.createDocument({ name: 'checked.pdf' });

    // The CHECK constraint is the last line of defence: a status the TypeScript
    // union does not allow must not be storable either.
    await expect(
      otherPool.query('UPDATE documents SET status = $2 WHERE id = $1', [
        created.id,
        'not-a-status',
      ]),
    ).rejects.toThrow(/check constraint/i);
  });
});
