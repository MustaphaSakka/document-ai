/**
 * HTTP Server using Node.js built-in http module
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Busboy from 'busboy';
import { documentService } from './document-service.js';
import { streamFileToFile } from './file-handler.js';

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
  size?: number;
  mimetype?: string;
}

interface BusboyFileObject {
  filename: string;
  encoding: string;
  mimeType: string;
}

/**
 * Handle POST /documents endpoint with file upload
 */
function handleCreateDocument(request: IncomingMessage, response: ServerResponse): void {
  try {
    // Validate content type
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      response.statusCode = 415;
      response.setHeader('Content-Type', 'application/json');
      const errorData: ErrorResponse = {
        error: 'Unsupported Media Type',
        message: 'Content-Type must be multipart/form-data',
      };
      response.end(JSON.stringify(errorData));
      return;
    }

    // Parse multipart form data using busboy
    const busboyInstance = Busboy({
      headers: request.headers,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
      },
    });

    let fileResult:
      | { filename: string; filepath: string; size: number; mimetype: string }
      | null = null;
    let uploadError: Error | null = null;
    let fileUploadComplete = false;
    let fileEventReceived = false;

    // Handle file upload
    busboyInstance.on('file', (_fieldname: string, file: NodeJS.ReadableStream, fileObject: BusboyFileObject) => {
      fileEventReceived = true;
      const filename = fileObject.filename;
      const mimetype = fileObject.mimeType;

      // Stream file and handle completion with callback
      streamFileToFile(file, filename, mimetype)
        .then((result) => {
          if ('error' in result) {
            uploadError = new Error(result.message);
            const readableStream = file as unknown as { destroy: (error?: Error) => void };
            readableStream.destroy();
          } else {
            fileResult = result;
          }
          fileUploadComplete = true;

          // Check if we can send response
          checkAndSendResponse();
        })
        .catch((error: Error) => {
          uploadError = error;
          fileUploadComplete = true;

          // Check if we can send response
          checkAndSendResponse();
        });
    });

    // Track when busboy finishes parsing
    let busboyFinished = false;

    busboyInstance.on('finish', () => {
      busboyFinished = true;

      // If no file was received, mark upload as complete
      if (!fileEventReceived) {
        fileUploadComplete = true;
      }

      // Check if we can send response
      checkAndSendResponse();
    });

    // Function to check if both operations are complete and send response
    function checkAndSendResponse(): void {
      // Only send response when both are complete
      if (!busboyFinished || !fileUploadComplete) {
        return;
      }

      sendResponse();
    }

    function sendResponse(): void {
      if (uploadError) {
        console.error('Upload error:', uploadError);
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        const errorData: ErrorResponse = {
          error: 'Upload Failed',
          message: uploadError.message,
        };
        response.end(JSON.stringify(errorData));
        return;
      }

      if (!fileResult) {
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        const errorData: ErrorResponse = {
          error: 'Bad Request',
          message: 'No file provided',
        };
        response.end(JSON.stringify(errorData));
        return;
      }

      // Create document record
      const document = documentService.createDocument({
        name: fileResult.filename,
        filepath: fileResult.filepath,
        size: fileResult.size,
        mimetype: fileResult.mimetype,
      });

      // Return 201 Created
      response.statusCode = 201;
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Location', `/documents/${document.id}`);

      const responseData: DocumentResponse = {
        id: document.id,
        name: document.name,
        status: document.status,
        size: document.size,
        mimetype: document.mimetype,
      };
      response.end(JSON.stringify(responseData));
    }

    // Handle busboy errors
    busboyInstance.on('error', (error) => {
      console.error('Busboy error:', error);
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json');
        const errorData: ErrorResponse = {
          error: 'Internal Server Error',
          message: 'Failed to process file upload',
        };
        response.end(JSON.stringify(errorData));
      }
    });

    // Add debug logging for busboy events
    busboyInstance.on('partsLimit', () => {
      console.log('Parts limit reached');
    });

    busboyInstance.on('filesLimit', () => {
      console.log('Files limit reached');
    });

    busboyInstance.on('fieldsLimit', () => {
      console.log('Fields limit reached');
    });

    // Pipe request to busboy and handle completion
    request.pipe(busboyInstance);

    // Handle request end
    request.on('end', () => {
      // Set busboy finished flag if finish event hasn't fired yet
      if (!busboyFinished) {
        busboyFinished = true;
        checkAndSendResponse();
      }
    });

    // Handle request errors
    request.on('error', (error) => {
      console.error('Request error:', error);
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json');
        const errorData: ErrorResponse = {
          error: 'Internal Server Error',
          message: 'Request processing failed',
        };
        response.end(JSON.stringify(errorData));
      }
    });
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
