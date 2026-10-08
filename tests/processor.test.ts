/**
 * Tests for document processing: S3 read plus text extraction.
 * Runs the real pdf2json parser against the committed PDF fixture.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { processDocument } from '../src/processor';
import { documentService } from '../src/document-service';
import { resetIdCounter } from '../src/utils';

const TEXT_CONTENT = 'hello world from a text file';

// Read the fixture lazily: the factory below is hoisted above the imports.
function readPdfFixture(): Buffer {
  return readFileSync(new URL('../test-from-s3.pdf', import.meta.url));
}

// Mock S3 so that GetObject returns fixture content depending on the key
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = vi.fn(async (command: { constructor: { name: string }; input: { Key?: string } }) => {
      if (command.constructor.name !== 'GetObjectCommand') {
        throw new Error(`Unexpected command: ${command.constructor.name}`);
      }

      const key = command.input.Key ?? '';

      if (key.includes('broken')) {
        return { Body: Readable.from([Buffer.from('this is not a PDF')]) };
      }
      if (key.endsWith('.pdf')) {
        return { Body: Readable.from([readPdfFixture()]) };
      }
      return { Body: Readable.from([Buffer.from(TEXT_CONTENT)]) };
    });
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe('Document processing', () => {
  beforeEach(() => {
    documentService.clearDocuments();
    resetIdCounter();
  });

  it('should extract the text of a PDF', async () => {
    const document = documentService.createDocument({
      name: 'report.pdf',
      s3Bucket: 'test-bucket',
      s3Key: 'documents/report.pdf',
      mimetype: 'application/pdf',
    });

    await processDocument(document.id, { simulateDelay: 1 });

    expect(document.status).toBe('completed');
    expect(document.processingResult?.extractedText).toBeDefined();
    expect(document.processingResult?.extractedText?.length).toBeGreaterThan(0);
    expect(document.processingResult?.wordCount).toBeGreaterThan(0);
    expect(document.processingResult?.numpages).toBeGreaterThanOrEqual(1);
    expect(document.processingResult?.processedAt).toBeInstanceOf(Date);
  });

  it('should count words on the decoded content for a text file', async () => {
    const document = documentService.createDocument({
      name: 'notes.txt',
      s3Bucket: 'test-bucket',
      s3Key: 'documents/notes.txt',
      mimetype: 'text/plain',
    });

    await processDocument(document.id, { simulateDelay: 1 });

    expect(document.status).toBe('completed');
    expect(document.processingResult?.extractedText).toBe(TEXT_CONTENT);
    expect(document.processingResult?.wordCount).toBe(6);
    expect(document.processingResult?.pageEstimated).toBe(1);
  });

  it('should not expose text for a type that is not text-extracted', async () => {
    const document = documentService.createDocument({
      name: 'letter.docx',
      s3Bucket: 'test-bucket',
      s3Key: 'documents/letter.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await processDocument(document.id, { simulateDelay: 1 });

    expect(document.status).toBe('completed');
    expect(document.processingResult?.extractedText).toBeUndefined();
  });

  it('should mark the document as failed when extraction fails', async () => {
    const document = documentService.createDocument({
      name: 'broken.pdf',
      s3Bucket: 'test-bucket',
      s3Key: 'documents/broken.pdf',
      mimetype: 'application/pdf',
    });

    await expect(processDocument(document.id, { simulateDelay: 1 })).rejects.toThrow();

    expect(document.status).toBe('failed');
    expect(document.error).toBeDefined();
    expect(document.processingResult).toBeUndefined();
  });

  it('should throw for an unknown document', async () => {
    await expect(processDocument('unknown')).rejects.toThrow('not found');
  });

  it('should fail a document without S3 location', async () => {
    const document = documentService.createDocument({ name: 'local.txt' });

    await expect(processDocument(document.id, { simulateDelay: 1 })).rejects.toThrow(
      'no S3 location',
    );

    expect(document.status).toBe('failed');
  });
});
