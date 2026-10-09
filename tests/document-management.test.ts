/**
 * Tests for the document management endpoints: list, status, text and delete
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server';
import { documentService } from '../src/document-service';
import { s3Client } from '../src/s3-client';
import { resetIdCounter } from '../src/utils';
import { setCreatedAt } from './db.js';

let server: http.Server;
let baseUrl: string;

const S3_KEY = 'documents/11111111-2222-3333-4444-555555555555.pdf';
const EXTRACTED_KEY = 'documents/11111111-2222-3333-4444-555555555555-extracted.json';

/** Create a document that finished processing and has extracted text */
async function seedCompletedDocument(name = 'report.pdf') {
  const document = await documentService.createDocument({
    name,
    s3Bucket: 'test-bucket',
    s3Key: S3_KEY,
    size: 2048,
    mimetype: 'application/pdf',
  });

  await documentService.updateDocumentResult(document.id, {
    wordCount: 4,
    pageEstimated: 1,
    processingDuration: 12,
    processedAt: new Date('2026-02-01T10:00:00.000Z'),
    extractedText: 'Hello from the PDF',
    numpages: 1,
  });

  return document;
}

/**
 * Create `count` documents with a distinct created_at each, one day apart, and
 * return their names oldest first — the reverse of the order the API returns.
 * Distinct timestamps are what make the pagination tests deterministic. The
 * prefix groups a set of documents under a shared name fragment, which is what
 * the search filter is exercised against.
 */
async function seedOrderedDocuments(count: number, prefix = 'doc'): Promise<string[]> {
  const names: string[] = [];

  for (let index = 1; index <= count; index += 1) {
    const name = `${prefix}-${index}.pdf`;
    const document = await documentService.createDocument({ name });
    await setCreatedAt(document.id, new Date(Date.UTC(2026, 0, index)));
    names.push(name);
  }

  return names;
}

/**
 * Create one document already in the state a filter test needs. The mimetype is
 * stored at creation; the status is moved afterwards, the way processing moves
 * it, since a document is always born `pending`.
 */
async function seedDocument(
  name: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  mimetype: string,
) {
  const document = await documentService.createDocument({ name, mimetype });

  if (status !== 'pending') {
    await documentService.updateDocumentStatus(
      document.id,
      status,
      status === 'failed' ? 'Extraction failed' : undefined,
    );
  }

  return document;
}

/** Names of the documents a list query returns, in the order the API sorted them. */
async function namesFrom(query: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/documents${query}`);
  const data = await response.json();

  expect(response.status).toBe(200);
  return data.documents.map((document: { name: string }) => document.name);
}

/** Keys passed to DeleteObjectCommand, in call order */
function deletedKeys(): string[] {
  return vi
    .mocked(s3Client.send)
    .mock.calls.filter(([command]) => command.constructor.name === 'DeleteObjectCommand')
    .map(([command]) => (command as unknown as { input: { Key: string } }).input.Key);
}

describe('Document management endpoints', () => {
  beforeAll(() => {
    server = createServer();
    server.listen(0);

    const address = server.address();
    if (address && typeof address === 'object') {
      baseUrl = `http://localhost:${address.port}`;
    }
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(async () => {
    await documentService.clearDocuments();
    resetIdCounter();
    vi.clearAllMocks();
  });

  describe('GET /documents', () => {
    it('should return an empty page with the default pagination', async () => {
      const response = await fetch(`${baseUrl}/documents`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(await response.json()).toEqual({
        documents: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it('should return the most recent document first', async () => {
      // created_at belongs to the database now: the timestamps are written
      // there instead of onto the returned objects, which are only copies.
      const oldest = await documentService.createDocument({ name: 'oldest.txt' });
      const newest = await documentService.createDocument({ name: 'newest.txt' });
      const middle = await documentService.createDocument({ name: 'middle.txt' });

      await setCreatedAt(oldest.id, new Date('2026-01-01T00:00:00.000Z'));
      await setCreatedAt(newest.id, new Date('2026-03-01T00:00:00.000Z'));
      await setCreatedAt(middle.id, new Date('2026-02-01T00:00:00.000Z'));

      const response = await fetch(`${baseUrl}/documents`);
      const data = await response.json();

      expect(data.total).toBe(3);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(20);
      expect(data.totalPages).toBe(1);
      expect(data.documents.map((document: { name: string }) => document.name)).toEqual([
        'newest.txt',
        'middle.txt',
        'oldest.txt',
      ]);
    });

    it('should break a tie on created_at with the id', async () => {
      // Three documents sharing one timestamp: only the second sort key can
      // decide. Ids increase with creation order, so descending id means the
      // most recently created comes first.
      const documents = await Promise.all(
        ['first.txt', 'second.txt', 'third.txt'].map((name) =>
          documentService.createDocument({ name }),
        ),
      );
      for (const document of documents) {
        await setCreatedAt(document.id, new Date('2026-04-01T00:00:00.000Z'));
      }

      const response = await fetch(`${baseUrl}/documents`);
      const data = await response.json();

      expect(data.documents.map((document: { name: string }) => document.name)).toEqual([
        'third.txt',
        'second.txt',
        'first.txt',
      ]);
    });

    it('should default page to 1 when only the limit is given', async () => {
      await seedOrderedDocuments(3);

      const response = await fetch(`${baseUrl}/documents?limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      expect(data.totalPages).toBe(1);
      expect(data.documents).toHaveLength(3);
    });

    it('should return the requested page', async () => {
      const names = await seedOrderedDocuments(5);

      const response = await fetch(`${baseUrl}/documents?page=2&limit=2`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(2);
      // Page 2 starts after the two most recent, and stays most-recent-first
      // within itself — `names` runs oldest first, hence the descending indexes.
      expect(data.documents.map((document: { name: string }) => document.name)).toEqual([
        names[2],
        names[1],
      ]);
    });

    it('should keep the total independent of the page', async () => {
      await seedOrderedDocuments(5);

      for (const page of [1, 2, 3]) {
        const response = await fetch(`${baseUrl}/documents?page=${page}&limit=2`);
        const data = await response.json();

        expect(data.total).toBe(5);
        expect(data.totalPages).toBe(3);
      }
    });

    it('should return an empty page past the last one', async () => {
      await seedOrderedDocuments(3);

      const response = await fetch(`${baseUrl}/documents?page=99&limit=2`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.documents).toEqual([]);
      expect(data.page).toBe(99);
      expect(data.total).toBe(3);
      expect(data.totalPages).toBe(2);
    });

    it('should accept the maximum limit and refuse anything above it', async () => {
      const accepted = await fetch(`${baseUrl}/documents?limit=100`);
      expect(accepted.status).toBe(200);
      expect((await accepted.json()).limit).toBe(100);

      const refused = await fetch(`${baseUrl}/documents?limit=101`);
      expect(refused.status).toBe(400);
      expect(await refused.json()).toEqual({
        error: 'Bad Request',
        message: "Query parameter 'limit' must not exceed 100",
      });
    });

    it.each(['0', '-1', 'abc', '1.5', '', '1e2', '0x10'])(
      'should refuse page=%j',
      async (value) => {
        const response = await fetch(`${baseUrl}/documents?page=${encodeURIComponent(value)}`);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: 'Bad Request',
          message: "Query parameter 'page' must be an integer >= 1",
        });
      },
    );

    it.each(['0', '-1', 'abc', '1.5', ''])(
      'should refuse limit=%j',
      async (value) => {
        const response = await fetch(`${baseUrl}/documents?limit=${encodeURIComponent(value)}`);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: 'Bad Request',
          message: "Query parameter 'limit' must be an integer >= 1",
        });
      },
    );

    it('should refuse a parameter given twice', async () => {
      const response = await fetch(`${baseUrl}/documents?page=1&page=2`);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Bad Request',
        message: "Query parameter 'page' must be given at most once",
      });
    });

    it('should not expose the extracted text', async () => {
      await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents`);
      const data = await response.json();

      expect(data.documents[0].processingResult).toBeDefined();
      expect(data.documents[0].processingResult).not.toHaveProperty('extractedText');
      expect(data.documents[0]).not.toHaveProperty('extractedText');
    });
  });

  describe('GET /documents with filters', () => {
    /**
     * Five documents covering every filter axis: two matching invoices, a failed
     * contract, a completed text file and a PNG still processing. Newest first,
     * the order the API returns them in, they are photo, notes, contrat,
     * facture-fevrier, facture-janvier.
     */
    async function seedCatalogue(): Promise<void> {
      await seedDocument('facture-janvier.pdf', 'completed', 'application/pdf');
      await seedDocument('facture-fevrier.pdf', 'completed', 'application/pdf');
      await seedDocument('contrat.pdf', 'failed', 'application/pdf');
      await seedDocument('notes.txt', 'completed', 'text/plain');
      await seedDocument('photo.png', 'processing', 'image/png');
    }

    it('should filter on a fragment of the name', async () => {
      await seedCatalogue();

      expect(await namesFrom('?search=facture')).toEqual([
        'facture-fevrier.pdf',
        'facture-janvier.pdf',
      ]);
    });

    it('should match the name regardless of case', async () => {
      await seedCatalogue();

      expect(await namesFrom('?search=FACTURE')).toHaveLength(2);
      expect(await namesFrom('?search=FaCtUrE')).toHaveLength(2);
    });

    it('should ignore whitespace around the search', async () => {
      await seedCatalogue();

      expect(await namesFrom('?search=%20facture%20')).toHaveLength(2);
    });

    it('should answer an empty page when the search matches nothing', async () => {
      await seedCatalogue();

      const response = await fetch(`${baseUrl}/documents?search=introuvable`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.documents).toEqual([]);
      expect(data.total).toBe(0);
      expect(data.totalPages).toBe(0);
    });

    it('should filter on status=completed', async () => {
      await seedCatalogue();

      expect(await namesFrom('?status=completed')).toEqual([
        'notes.txt',
        'facture-fevrier.pdf',
        'facture-janvier.pdf',
      ]);
    });

    it('should filter on status=failed', async () => {
      await seedCatalogue();

      expect(await namesFrom('?status=failed')).toEqual(['contrat.pdf']);
    });

    it('should filter on the mime type', async () => {
      await seedCatalogue();

      expect(await namesFrom('?mimeType=application/pdf')).toEqual([
        'contrat.pdf',
        'facture-fevrier.pdf',
        'facture-janvier.pdf',
      ]);
      expect(await namesFrom('?mimeType=text/plain')).toEqual(['notes.txt']);
    });

    it('should combine the search and the status', async () => {
      await seedCatalogue();

      expect(await namesFrom('?search=facture&status=completed')).toHaveLength(2);
      expect(await namesFrom('?search=facture&status=failed')).toEqual([]);
    });

    it('should combine the three filters', async () => {
      await seedCatalogue();

      expect(await namesFrom('?search=facture&status=completed&mimeType=application/pdf')).toEqual([
        'facture-fevrier.pdf',
        'facture-janvier.pdf',
      ]);

      // Filters narrow together: one that matches nothing excludes the document
      // the other two accept.
      expect(await namesFrom('?search=facture&status=completed&mimeType=text/plain')).toEqual([]);
    });

    it('should count and paginate the filtered results, not the stored ones', async () => {
      const names = await seedOrderedDocuments(5, 'facture');
      // Excluded by the filter, so an unfiltered total would be 6.
      await seedDocument('contrat.pdf', 'completed', 'application/pdf');

      const first = await fetch(`${baseUrl}/documents?search=facture&page=1&limit=2`);
      const firstPage = await first.json();

      expect(firstPage.total).toBe(5);
      expect(firstPage.totalPages).toBe(3);
      expect(firstPage.documents.map((document: { name: string }) => document.name)).toEqual([
        names[4],
        names[3],
      ]);

      const second = await fetch(`${baseUrl}/documents?search=facture&page=2&limit=2`);
      const secondPage = await second.json();

      expect(secondPage.total).toBe(5);
      expect(secondPage.documents.map((document: { name: string }) => document.name)).toEqual([
        names[2],
        names[1],
      ]);
    });

    it('should return an empty page past the last filtered page', async () => {
      await seedOrderedDocuments(3, 'facture');
      await seedOrderedDocuments(4, 'contrat');

      const response = await fetch(`${baseUrl}/documents?search=facture&page=9&limit=2`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.documents).toEqual([]);
      expect(data.page).toBe(9);
      // Three matching documents out of the seven actually stored.
      expect(data.total).toBe(3);
      expect(data.totalPages).toBe(2);
    });

    it('should leave the unfiltered list untouched', async () => {
      await seedCatalogue();

      const response = await fetch(`${baseUrl}/documents`);
      const data = await response.json();

      expect(data.total).toBe(5);
      expect(data.totalPages).toBe(1);
      expect(data.documents).toHaveLength(5);
    });

    it.each(['unknown', 'PENDING', 'done', ''])(
      'should refuse status=%j',
      async (value) => {
        const response = await fetch(`${baseUrl}/documents?status=${encodeURIComponent(value)}`);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: 'Bad Request',
          message:
            "Query parameter 'status' must be one of: pending, processing, completed, failed",
        });
      },
    );

    it.each(['search', 'mimeType'])('should refuse an empty %s', async (name) => {
      const response = await fetch(`${baseUrl}/documents?${name}=`);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Bad Request',
        message: `Query parameter '${name}' must not be empty`,
      });
    });

    it('should refuse a search made only of spaces', async () => {
      const response = await fetch(`${baseUrl}/documents?search=%20%20`);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Bad Request',
        message: "Query parameter 'search' must not be empty",
      });
    });

    it.each(['search', 'mimeType', 'status'])('should refuse %s given twice', async (name) => {
      const response = await fetch(`${baseUrl}/documents?${name}=a&${name}=b`);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Bad Request',
        message: `Query parameter '${name}' must be given at most once`,
      });
    });
  });

  describe('GET /documents/:id/status', () => {
    it('should return 404 for an unknown document', async () => {
      const response = await fetch(`${baseUrl}/documents/unknown/status`);

      expect(response.status).toBe(404);
      expect((await response.json()).error).toBe('Not Found');
    });

    it('should return pending for a new document', async () => {
      const document = await documentService.createDocument({ name: 'new.pdf' });

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: document.id,
        status: 'pending',
        createdAt: document.createdAt.toISOString(),
      });
    });

    it('should return completed without the processing result', async () => {
      const document = await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);
      const data = await response.json();

      expect(data.status).toBe('completed');
      expect(data).not.toHaveProperty('processingResult');
    });

    it('should return failed with the error message', async () => {
      const document = await documentService.createDocument({ name: 'broken.pdf' });
      await documentService.updateDocumentStatus(document.id, 'failed', 'Extraction failed');

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);
      const data = await response.json();

      expect(data.status).toBe('failed');
      expect(data.error).toBe('Extraction failed');
    });
  });

  describe('GET /documents/:id/text', () => {
    it('should return 404 for an unknown document', async () => {
      const response = await fetch(`${baseUrl}/documents/unknown/text`);

      expect(response.status).toBe(404);
    });

    it('should return 409 while the document is processing', async () => {
      const document = await documentService.createDocument({ name: 'busy.pdf' });
      await documentService.updateDocumentStatus(document.id, 'processing');

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toContain('processing');
    });

    it('should return 409 when processing failed', async () => {
      const document = await documentService.createDocument({ name: 'broken.pdf' });
      await documentService.updateDocumentStatus(document.id, 'failed', 'Extraction failed');

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe('Extraction failed');
    });

    it('should return 404 when the document has no extracted text', async () => {
      // Word documents are not text-extracted
      const document = await documentService.createDocument({ name: 'letter.docx' });
      await documentService.updateDocumentResult(document.id, {
        wordCount: 3,
        pageEstimated: 1,
        processingDuration: 5,
        processedAt: new Date(),
      });

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(404);
    });

    it('should return the extracted text', async () => {
      const document = await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: document.id,
        text: 'Hello from the PDF',
        numpages: 1,
        extractedAt: '2026-02-01T10:00:00.000Z',
      });
    });

    it('should return an empty string for a PDF without a text layer', async () => {
      const document = await documentService.createDocument({ name: 'scan.pdf' });
      await documentService.updateDocumentResult(document.id, {
        wordCount: 0,
        pageEstimated: 1,
        processingDuration: 5,
        processedAt: new Date(),
        extractedText: '',
        numpages: 1,
      });

      const response = await fetch(`${baseUrl}/documents/${document.id}/text`);

      expect(response.status).toBe(200);
      expect((await response.json()).text).toBe('');
    });
  });

  describe('DELETE /documents/:id', () => {
    it('should return 404 for an unknown document', async () => {
      const response = await fetch(`${baseUrl}/documents/unknown`, { method: 'DELETE' });

      expect(response.status).toBe(404);
    });

    it('should delete the document and its S3 objects', async () => {
      const document = await seedCompletedDocument();

      const response = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(response.status).toBe(204);
      expect(deletedKeys()).toEqual([S3_KEY, EXTRACTED_KEY]);
      expect(await documentService.getDocument(document.id)).toBeUndefined();

      const after = await fetch(`${baseUrl}/documents/${document.id}`);
      expect(after.status).toBe(404);
    });

    it('should return 404 on a second delete', async () => {
      const document = await seedCompletedDocument();
      await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      const second = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(second.status).toBe(404);
    });

    it('should delete a document without S3 location', async () => {
      const document = await documentService.createDocument({ name: 'local.txt' });

      const response = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(response.status).toBe(204);
      expect(deletedKeys()).toEqual([]);
      expect(await documentService.getDocument(document.id)).toBeUndefined();
    });

    it('should keep the document when S3 deletion fails', async () => {
      const document = await seedCompletedDocument();
      vi.mocked(s3Client.send).mockRejectedValueOnce(new Error('S3 unavailable'));

      const response = await fetch(`${baseUrl}/documents/${document.id}`, { method: 'DELETE' });

      expect(response.status).toBe(500);
      expect(await documentService.getDocument(document.id)).toBeDefined();
    });
  });

  describe('Routing', () => {
    it('should not let /documents/:id swallow /documents/:id/status', async () => {
      const document = await documentService.createDocument({ name: 'routing.pdf' });

      const response = await fetch(`${baseUrl}/documents/${document.id}/status`);
      const data = await response.json();

      expect(data.status).toBe('pending');
      expect(data).not.toHaveProperty('name');
    });

    it('should return 400 when the ID is empty', async () => {
      const response = await fetch(`${baseUrl}/documents/`);

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('Bad Request');
    });
  });
});
