/**
 * Domain types of a document, shared by the HTTP layer, the service and the
 * repository.
 *
 * They live here rather than in `document-service.ts` so that
 * `DocumentRepository` can describe what it returns without importing the module
 * that imports it — the data layer would otherwise depend on the business layer
 * for its types.
 */

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
