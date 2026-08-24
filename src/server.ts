/**
 * HTTP Server using Node.js built-in http module
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  documentService,
  validateCreateRequest,
  type CreateDocumentRequest,
} from './document-service.js';

interface HealthResponse {
  status: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

interface DocumentResponse {
  id: string;
  name: string;
  status: string;
}

/**
 * Read request body as JSON
 */
function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();

      // Prevent memory issues with very large requests
      if (body.length > 1e6) {
        request.destroy();
        reject(new Error('Request body too large'));
      }
    });

    request.on('end', () => {
      resolve(body);
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Handle POST /documents endpoint
 */
async function handleCreateDocument(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    // Validate content type
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      response.statusCode = 415;
      response.setHeader('Content-Type', 'application/json');
      const errorData: ErrorResponse = {
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
      };
      response.end(JSON.stringify(errorData));
      return;
    }

    // Read request body
    const body = await readRequestBody(request);

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      const errorData: ErrorResponse = {
        error: 'Bad Request',
        message: 'Invalid JSON',
      };
      response.end(JSON.stringify(errorData));
      return;
    }

    // Validate request data
    const validationError = validateCreateRequest(data);
    if (validationError) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(validationError));
      return;
    }

    // Create document
    const createRequest = data as CreateDocumentRequest;
    const document = documentService.createDocument(createRequest);

    // Return 201 Created
    response.statusCode = 201;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Location', `/documents/${document.id}`);

    const responseData: DocumentResponse = {
      id: document.id,
      name: document.name,
      status: document.status,
    };
    response.end(JSON.stringify(responseData));
  } catch (error) {
    console.error('Error creating document:', error);
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    const errorData: ErrorResponse = {
      error: 'Internal Server Error',
      message: 'An error occurred while creating the document',
    };
    response.end(JSON.stringify(errorData));
  }
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

  // Check for POST /documents
  if (request.method === 'POST' && request.url === '/documents') {
    void handleCreateDocument(request, response);
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
    console.log(`📄 Document submission: POST http://localhost:${port}/documents`);
  });

  return server;
}
