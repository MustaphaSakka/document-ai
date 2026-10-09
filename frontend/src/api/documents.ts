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

export function listDocuments(): Promise<DocumentListResponse> {
  return requestJson<DocumentListResponse>(DOCUMENTS_PATH);
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
