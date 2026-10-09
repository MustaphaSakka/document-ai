/** One function per backend endpoint. No state, no Vue here. */

import { requestJson, requestNoContent } from './client';
import type {
  Document,
  DocumentListResponse,
  DocumentStatusResponse,
  DocumentTextResponse,
} from '../types/document';

/**
 * Requests go through /api, which the dev server proxies to the backend after
 * stripping the prefix (see vite.config.ts). Keeping the API under its own
 * namespace is what stops it colliding with the `/documents` SPA route.
 */
const API_PREFIX = '/api';

const DOCUMENTS_PATH = `${API_PREFIX}/documents`;

function documentPath(id: string): string {
  return `${DOCUMENTS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * One page of documents. `page` is 1-based, as the user counts pages.
 *
 * `URLSearchParams` builds the query rather than string concatenation: it
 * encodes the values for the URL, so a caller cannot produce a malformed query
 * by passing something unexpected.
 */
export function listDocuments(page: number, limit: number): Promise<DocumentListResponse> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });

  return requestJson<DocumentListResponse>(`${DOCUMENTS_PATH}?${query.toString()}`);
}

export function getDocument(id: string): Promise<Document> {
  return requestJson<Document>(documentPath(id));
}

export function getDocumentStatus(id: string): Promise<DocumentStatusResponse> {
  return requestJson<DocumentStatusResponse>(`${documentPath(id)}/status`);
}

export function getDocumentText(id: string): Promise<DocumentTextResponse> {
  return requestJson<DocumentTextResponse>(`${documentPath(id)}/text`);
}

export function deleteDocument(id: string): Promise<void> {
  return requestNoContent(documentPath(id), { method: 'DELETE' });
}

/**
 * Sends the file as multipart/form-data.
 *
 * The Content-Type header is deliberately not set: the browser has to add it
 * itself to include the multipart boundary it generates.
 */
export function uploadDocument(file: File): Promise<Document> {
  const body = new FormData();
  body.append('file', file, file.name);

  return requestJson<Document>(DOCUMENTS_PATH, { method: 'POST', body });
}
