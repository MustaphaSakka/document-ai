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

/**
 * Which slice of the list to read.
 *
 * `page` is 1-based, as a client counts pages. Both values are positive
 * integers; the HTTP layer is what enforces that, since it is the only place a
 * value can arrive from outside the program.
 */
export interface DocumentPageRequest {
  page: number;
  limit: number;
}

/**
 * One page of documents, with the numbers the client needs to know where it is:
 * `total` counts every stored document, not the ones on this page.
 */
export interface DocumentPage {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
