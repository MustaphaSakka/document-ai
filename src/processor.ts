/**
 * Document Processor
 * Handles asynchronous document processing
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from './s3-client.js';
import { documentService } from './document-service.js';
import type { ProcessingResult } from './document-service.js';

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
  const document = documentService.getDocument(documentId);
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  // Update status to processing first
  documentService.updateDocumentStatus(documentId, 'processing');

  if (!document.s3Bucket || !document.s3Key) {
    documentService.updateDocumentStatus(documentId, 'failed', 'Document has no S3 location');
    throw new Error(`Document ${documentId} has no S3 location`);
  }

  // Simulate async processing with setTimeout
  await new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          // Check if we should simulate failure
          if (options.simulateFailure) {
            documentService.updateDocumentStatus(documentId, 'failed', 'Simulated processing failure');
            reject(new Error('Simulated processing failure'));
            return;
          }

          // Perform actual processing
          const result = await analyzeDocument(document.s3Bucket!, document.s3Key!);
          documentService.updateDocumentResult(documentId, result);
          resolve();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
          documentService.updateDocumentStatus(documentId, 'failed', errorMessage);
          reject(error instanceof Error ? error : new Error(errorMessage));
        }
      })();
    }, options.simulateDelay || 100);
  });
}

/**
 * Analyze document and extract metrics
 * NOTE: Loads entire document into memory. Suitable for learning/small documents.
 * For production, consider stream-based processing or size limits.
 */
async function analyzeDocument(s3Bucket: string, s3Key: string): Promise<ProcessingResult> {
  const startTime = Date.now();
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit for memory safety
  let totalSize = 0;

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
      if (totalSize > MAX_SIZE_BYTES) {
        throw new Error(`Document too large (${Math.round(totalSize / 1024 / 1024)}MB). Maximum size: ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)}MB`);
      }
    }

    const content = Buffer.concat(chunks).toString('utf-8');

    // Simple text analysis
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Estimate pages (assuming ~250 words per page)
    const pageEstimated = Math.ceil(wordCount / 250);

    const processingDuration = Date.now() - startTime;

    return {
      wordCount,
      pageEstimated,
      processingDuration,
      processedAt: new Date(),
    };
  } catch (error) {
    throw new Error(`Failed to read from S3: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
  }
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
