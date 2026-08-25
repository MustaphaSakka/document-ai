/**
 * Document Processor
 * Handles asynchronous document processing
 */

import fs from 'node:fs';
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

  if (!document.filepath) {
    documentService.updateDocumentStatus(documentId, 'failed', 'Document has no file to process');
    throw new Error(`Document ${documentId} has no file to process`);
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
          const result = await analyzeDocument(document.filepath!);
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
 */
async function analyzeDocument(filepath: string): Promise<ProcessingResult> {
  const startTime = Date.now();

  // Read file content
  const content = await fs.promises.readFile(filepath, 'utf-8');

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