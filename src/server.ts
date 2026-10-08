/**
 * HTTP Server using Node.js built-in http module
 *
 * The server is a thin router: it parses the request path, finds the matching
 * route and delegates to a handler. Handlers live in `src/routes/`.
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createDocument,
  deleteDocument,
  getDocument,
  getDocumentStatus,
  getDocumentText,
  listDocuments,
} from './routes/documents.js';

interface HealthResponse {
  status: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

type RouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

interface Route {
  method: string;
  segments: string[];
  handler: RouteHandler;
}

/**
 * GET /health
 */
function handleHealth(_request: IncomingMessage, response: ServerResponse): void {
  const healthData: HealthResponse = { status: 'ok' };

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(healthData));
}

/**
 * Handle 404 Not Found
 */
function handleNotFound(response: ServerResponse): void {
  const errorData: ErrorResponse = { error: 'Not Found' };

  response.statusCode = 404;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(errorData));
}

/**
 * Route table. Matched on the exact number of path segments, so
 * `/documents/:id` cannot swallow `/documents/:id/status`.
 * A segment starting with ':' captures its value into params.
 */
const routes: Route[] = [
  { method: 'GET', segments: ['health'], handler: handleHealth },
  { method: 'POST', segments: ['documents'], handler: createDocument },
  { method: 'GET', segments: ['documents'], handler: listDocuments },
  { method: 'GET', segments: ['documents', ':id'], handler: getDocument },
  { method: 'GET', segments: ['documents', ':id', 'status'], handler: getDocumentStatus },
  { method: 'GET', segments: ['documents', ':id', 'text'], handler: getDocumentText },
  { method: 'DELETE', segments: ['documents', ':id'], handler: deleteDocument },
];

/**
 * Find the first route matching both the method and the path segments
 */
function matchRoute(
  method: string,
  segments: string[],
): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== segments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matched = true;

    for (const [index, part] of route.segments.entries()) {
      const value = segments[index] ?? '';

      if (part.startsWith(':')) {
        params[part.slice(1)] = value;
      } else if (part !== value) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { handler: route.handler, params };
    }
  }

  return null;
}

/**
 * Run a route handler, turning any thrown error or rejected promise into a 500
 */
async function runHandler(
  handler: RouteHandler,
  request: IncomingMessage,
  response: ServerResponse,
  params: Record<string, string>,
  pathname: string,
): Promise<void> {
  try {
    await handler(request, response, params);
  } catch (error) {
    console.error(`Error handling ${request.method ?? 'UNKNOWN'} ${pathname}:`, error);

    if (!response.headersSent) {
      const errorData: ErrorResponse = {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      };
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(errorData));
    }
  }
}

/**
 * Create and configure HTTP server
 */
export function createServer(): http.Server {
  return http.createServer((request: IncomingMessage, response: ServerResponse) => {
    // request.url is the raw path plus query string, e.g. "/documents?limit=10".
    // new URL() turns it into a pathname we can match on.
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    const segments = pathname.split('/').slice(1); // drop the leading ''
    const match = matchRoute(request.method ?? 'GET', segments);

    if (!match) {
      handleNotFound(response);
      return;
    }

    void runHandler(match.handler, request, response, match.params, pathname);
  });
}

/**
 * Start the HTTP server
 */
export function startServer(port: number): http.Server {
  const server = createServer();

  server.listen(port, () => {
    console.log(`🚀 Server listening on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📄 Documents: http://localhost:${port}/documents`);
  });

  return server;
}
