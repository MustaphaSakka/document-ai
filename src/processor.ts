/**
 * Document Processor
 * Handles asynchronous document processing
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from './s3-client.js';
import { documentService } from './document-service.js';
import type { ProcessingResult } from './document-service.js';
import { extractPDFText, getTextStatistics } from './extractors/pdf-text-extractor.js';
import { MAX_FILE_SIZE } from './s3-file-handler.js';

export interface ProcessingOptions {
  simulateDelay?: number; // milliseconds
  simulateFailure?: boolean;
}

/**
 * Process a document asynchronously
 */
export async function processDocument(
  documentId: string,
  options: ProcessingOptions = {},
): Promise<void> {
  const document = await documentService.getDocument(documentId);
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  // Update status to processing first
  await documentService.updateDocumentStatus(documentId, 'processing');

  if (!document.s3Bucket || !document.s3Key) {
    await documentService.updateDocumentStatus(documentId, 'failed', 'Document has no S3 location');
    throw new Error(`Document ${documentId} has no S3 location`);
  }

  // Simulate async processing with setTimeout
  await new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          // Check if we should simulate failure
          if (options.simulateFailure) {
            await documentService.updateDocumentStatus(
              documentId,
              'failed',
              'Simulated processing failure',
            );
            reject(new Error('Simulated processing failure'));
            return;
          }

          // Perform actual processing
          const result = await analyzeDocument(
            document.s3Bucket!,
            document.s3Key!,
            document.mimetype,
          );
          await documentService.updateDocumentResult(documentId, result);
          resolve();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';

          // Recording the failure is itself a database call now, so it can fail
          // too. Swallowing that here keeps the promise settled: an update that
          // throws would otherwise leave processDocument pending for ever.
          try {
            await documentService.updateDocumentStatus(documentId, 'failed', errorMessage);
          } catch (updateError) {
            console.error(`Could not record the failure of ${documentId}:`, updateError);
          }

          reject(error instanceof Error ? error : new Error(errorMessage));
        }
      })();
    }, options.simulateDelay || 100);
  });
}

/**
 * Analyze document and extract text plus metrics
 * NOTE: Loads entire document into memory. Suitable for learning/small documents.
 * For production, consider stream-based processing or size limits.
 */
async function analyzeDocument(
  s3Bucket: string,
  s3Key: string,
  mimetype?: string,
): Promise<ProcessingResult> {
  const startTime = Date.now();
  let totalSize = 0;
  let content: Buffer;

  try {
    // Get object from S3
    const s3Response = await s3Client.send(
      new GetObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
      })
    );

    // Convert stream to buffer/string with size limit
    const chunks: Buffer[] = [];
    const stream = s3Response.Body as NodeJS.ReadableStream;

    for await (const chunk of stream) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        totalSize += chunk.length;
      } else {
        const buffer = Buffer.from(chunk);
        chunks.push(buffer);
        totalSize += buffer.length;
      }

      // Prevent memory issues with large documents
      if (totalSize > MAX_FILE_SIZE) {
        throw new Error(
          `Document too large (${Math.round(totalSize / 1024 / 1024)}MB). ` +
            `Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }
    }

    content = Buffer.concat(chunks);
  } catch (error) {
    throw new Error(`Failed to read from S3: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
  }

  // PDFs need a real parser: splitting the raw bytes on whitespace would only
  // count binary noise, not words.
  if (mimetype === 'application/pdf') {
    const extraction = await extractPDFText(content);
    const stats = getTextStatistics(extraction);

    return {
      wordCount: stats.wordCount,
      pageEstimated:
        extraction.numpages > 0 ? extraction.numpages : Math.ceil(stats.wordCount / 250),
      processingDuration: Date.now() - startTime,
      processedAt: new Date(),
      extractedText: extraction.text,
      numpages: extraction.numpages,
    };
  }

  // Other types are treated as UTF-8 text
  const text = content.toString('utf-8');
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;

  const result: ProcessingResult = {
    wordCount,
    // Estimate pages (assuming ~250 words per page)
    pageEstimated: Math.ceil(wordCount / 250),
    processingDuration: Date.now() - startTime,
    processedAt: new Date(),
  };

  // Only plain text can be read back as document text
  if (mimetype === 'text/plain') {
    result.extractedText = text;
  }

  return result;
}

/**
 * Trigger processing for a document (doesn't wait for completion)
 */
export function triggerDocumentProcessing(
  documentId: string,
  options?: ProcessingOptions,
): void {
  // Fire and forget - don't await the promise
  processDocument(documentId, options).catch(error => {
    // Error is already handled in processDocument by updating status to failed
    console.error(`Processing failed for document ${documentId}:`, error);
  });
}
