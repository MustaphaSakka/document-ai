/**
 * The only module that talks to `fetch`.
 *
 * It turns a Response into typed data and converts every failure — network or
 * HTTP — into an ApiError carrying the status code, so callers can branch on
 * 404 / 409 / 413 without re-parsing anything.
 */

import type { ErrorResponse } from '../types/document';

/** Status used when the request never reached the server. */
export const NETWORK_ERROR_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null;
}

/** The backend always sends `{ error, message }`; fall back to the status code. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (isErrorResponse(body)) {
      return body.message ?? body.error ?? `Erreur ${response.status}`;
    }
  } catch {
    // Body was not JSON — fall through to the generic message.
  }

  return `Erreur ${response.status}`;
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, 'Impossible de contacter le serveur.');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return response;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);

  return (await response.json()) as T;
}

/** For endpoints answering 204 No Content, where there is no body to read. */
export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  await send(path, init);
}
