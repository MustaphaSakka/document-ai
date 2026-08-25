/**
 * Document Processor
 * Handles asynchronous document processing with AWS Textract
 */

import { documentService } from './document-service.js';
import { startTextDetection, pollTextDetection, extractTextFromBlocks } from './textract-processor.js';
import type { ProcessingResult } from './document-service.js';

export interface ProcessingOptions {
  simulateDelay?: number; // milliseconds
  simulateFailure?: boolean;
}

/**
 * Process a document asynchronously with Textract
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

          // Perform actual processing with Textract
          const result = await analyzeDocumentWithTextract(document.s3Bucket!, document.s3Key!);
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
 * Analyze document using AWS Textract
 */
async function analyzeDocumentWithTextract(s3Bucket: string, s3Key: string): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Start async text detection job
    console.log(`Starting Textract job for ${s3Bucket}/${s3Key}`);
    const jobId = await startTextDetection(s3Bucket, s3Key);
    console.log(`Textract job started: ${jobId}`);

    // Poll for results
    const response = await pollTextDetection(jobId);
    console.log(`Textract job completed: ${jobId}, Status: ${response.JobStatus}`);

    // Check if job failed
    if (response.JobStatus === 'FAILED' || response.JobStatus === 'PARTIAL_SUCCESS') {
      const message = response.StatusMessage || 'Textract processing failed';
      throw new Error(`Textract job failed: ${message}`);
    }

    // Extract text from Textract blocks
    const extractedText = extractTextFromBlocks(response.Blocks);

    // Calculate metrics from extracted text
    const words = extractedText.split(/\s+/).filter(word => word.length > 0);
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
    throw new Error(`Textract processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
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