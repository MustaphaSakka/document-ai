/**
 * HTTP Server using Node.js built-in http module
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface HealthResponse {
  status: string;
}

interface ErrorResponse {
  error: string;
}

/**
 * Handle GET /health endpoint
 */
function handleHealth(request: IncomingMessage, response: ServerResponse): void {
  if (request.method === 'GET' && request.url === '/health') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');

    const healthData: HealthResponse = { status: 'ok' };
    response.end(JSON.stringify(healthData));
    return;
  }

  handleNotFound(response);
}

/**
 * Handle 404 Not Found
 */
function handleNotFound(response: ServerResponse): void {
  response.statusCode = 404;
  response.setHeader('Content-Type', 'application/json');

  const errorData: ErrorResponse = { error: 'Not Found' };
  response.end(JSON.stringify(errorData));
}

/**
 * Create and configure HTTP server
 */
export function createServer(): http.Server {
  const server = http.createServer((request: IncomingMessage, response: ServerResponse) => {
    handleHealth(request, response);
  });

  return server;
}

/**
 * Start the HTTP server
 */
export function startServer(port: number): http.Server {
  const server = createServer();

  server.listen(port, () => {
    console.log(`🚀 Server listening on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
  });

  return server;
}
