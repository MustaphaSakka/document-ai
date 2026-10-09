/**
 * Shapes of the JSON payloads returned by the backend.
 *
 * These interfaces are compile-time only: the browser runs plain JavaScript,
 * so a response is trusted by contract, not verified at runtime.
 */

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessingResult {
  wordCount: number;
  pageEstimated: number;
  processingDuration: number;
  processedAt: string;
}

export interface Document {
  id: string;
  name: string;
  status: DocumentStatus;
  createdAt: string;
  size?: number;
  mimetype?: string;
  processingResult?: ProcessingResult;
  error?: string;
}

/**
 * One page of documents, mirroring `DocumentPage` in the backend
 * (`src/types/document.ts`). `GET /documents` always answers a page, so these
 * five fields travel together: `total` counts every stored document, not the
 * ones on this page, and `totalPages` is `ceil(total / limit)`.
 */
export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentStatusResponse {
  id: string;
  status: DocumentStatus;
  createdAt: string;
  error?: string;
}

export interface DocumentTextResponse {
  id: string;
  text: string;
  numpages: number;
  extractedAt: string;
}

/** Error body sent by the backend for every non-2xx response. */
export interface ErrorResponse {
  error?: string;
  message?: string;
}
