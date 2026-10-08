/**
 * HTTP handlers for the /documents endpoints
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import Busboy from 'busboy';
import { documentService } from '../document-service.js';
import type { Document } from '../document-service.js';
import { s3Client } from '../s3-client.js';
import { streamFileToS3, MAX_FILE_SIZE } from '../s3-file-handler.js';
import { triggerDocumentProcessing } from '../processor.js';

interface ErrorResponse {
  error: string;
  message?: string;
}

interface DocumentResponse {
  id: string;
  name: string;
  status: Document['status'];
  createdAt: string;
  size?: number;
  mimetype?: string;
  processingResult?: {
    wordCount: number;
    pageEstimated: number;
    processingDuration: number;
    processedAt: string;
  };
  error?: string;
}

interface DocumentStatusResponse {
  id: string;
  status: Document['status'];
  createdAt: string;
  error?: string;
}

interface DocumentTextResponse {
  id: string;
  text: string;
  numpages: number;
  extractedAt: string;
}

interface BusboyFileObject {
  filename: string;
  encoding: string;
  mimeType: string;
}

/**
 * Send a JSON response, unless the response was already sent
 */
function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  if (response.headersSent) {
    return;
  }

  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

/**
 * Send a JSON error response
 */
function sendError(
  response: ServerResponse,
  statusCode: number,
  error: string,
  message?: string,
): void {
  const body: ErrorResponse = { error, message };
  sendJson(response, statusCode, body);
}

/**
 * Serialize a document for HTTP responses.
 * Never exposes extractedText: GET /documents/:id/text is the endpoint for that.
 */
function toDocumentResponse(document: Document): DocumentResponse {
  const { processingResult } = document;

  return {
    id: document.id,
    name: document.name,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    size: document.size,
    mimetype: document.mimetype,
    processingResult: processingResult
      ? {
          wordCount: processingResult.wordCount,
          pageEstimated: processingResult.pageEstimated,
          processingDuration: processingResult.processingDuration,
          processedAt: processingResult.processedAt.toISOString(),
        }
      : undefined,
    error: document.error,
  };
}

/**
 * Look up a document by ID, sending the matching error response when the ID is
 * missing or unknown. Returns null when a response has already been sent.
 */
function findDocument(id: string | undefined, response: ServerResponse): Document | null {
  if (!id) {
    sendError(response, 400, 'Bad Request', 'Document ID is required');
    return null;
  }

  const document = documentService.getDocument(id);
  if (!document) {
    sendError(response, 404, 'Not Found', `Document ${id} not found`);
    return null;
  }

  return document;
}

/**
 * POST /documents - upload a file and create a document
 */
export function createDocument(request: IncomingMessage, response: ServerResponse): void {
  try {
    // Validate content type
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      sendError(
        response,
        415,
        'Unsupported Media Type',
        'Content-Type must be multipart/form-data',
      );
      return;
    }

    // Parse multipart form data using busboy
    const busboyInstance = Busboy({
      headers: request.headers,
      limits: {
        fileSize: MAX_FILE_SIZE, // 5 MB, see s3-file-handler.ts
      },
    });

    let fileResult: {
      filename: string;
      s3Bucket: string;
      s3Key: string;
      size: number;
      mimetype: string;
    } | null = null;
    let uploadError: Error | null = null;
    let uploadErrorStatus = 400; // 413 when the file exceeds MAX_FILE_SIZE
    let fileUploadComplete = false;
    let fileEventReceived = false;
    let responseSent = false; // Prevent duplicate responses

    // Handle file upload
    busboyInstance.on(
      'file',
      (_fieldname: string, file: NodeJS.ReadableStream, fileObject: BusboyFileObject) => {
        fileEventReceived = true;
        const filename = fileObject.filename;
        const mimetype = fileObject.mimeType;

        // Stream file to S3 and handle completion with callback
        streamFileToS3(file, filename, mimetype)
          .then((result) => {
            if ('error' in result) {
              uploadError = new Error(result.message);
              uploadErrorStatus = result.statusCode ?? 400;
              // Destroy the stream to stop reading
              const readableStream = file as unknown as { destroy: (error?: Error) => void };
              if (readableStream.destroy) {
                readableStream.destroy();
              }
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
      },
    );

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
      // Prevent duplicate responses
      if (responseSent) {
        return;
      }
      responseSent = true;

      if (uploadError) {
        console.error('Upload error:', uploadError);
        sendError(
          response,
          uploadErrorStatus,
          uploadErrorStatus === 413 ? 'Payload Too Large' : 'Upload Failed',
          uploadError.message,
        );
        return;
      }

      if (!fileResult) {
        sendError(response, 400, 'Bad Request', 'No file provided');
        return;
      }

      // Create document record
      const document = documentService.createDocument({
        name: fileResult.filename,
        s3Bucket: fileResult.s3Bucket,
        s3Key: fileResult.s3Key,
        size: fileResult.size,
        mimetype: fileResult.mimetype,
      });

      // Trigger async processing (fire and forget)
      triggerDocumentProcessing(document.id);

      // Return 201 Created
      response.statusCode = 201;
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Location', `/documents/${document.id}`);

      const responseData: DocumentResponse = {
        id: document.id,
        name: document.name,
        status: document.status,
        createdAt: document.createdAt.toISOString(),
        size: document.size,
        mimetype: document.mimetype,
      };
      response.end(JSON.stringify(responseData));
    }

    // Handle busboy errors
    busboyInstance.on('error', (error) => {
      console.error('Busboy error:', error);
      sendError(response, 500, 'Internal Server Error', 'Failed to process file upload');
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

    // Pipe request to busboy
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
      sendError(response, 500, 'Internal Server Error', 'Request processing failed');
    });
  } catch (error) {
    console.error('Error creating document:', error);
    sendError(
      response,
      500,
      'Internal Server Error',
      'An error occurred while creating the document',
    );
  }
}

/**
 * GET /documents - list all documents, most recent first
 */
export function listDocuments(_request: IncomingMessage, response: ServerResponse): void {
  const documents = documentService
    .getAllDocuments()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toDocumentResponse);

  sendJson(response, 200, { documents, total: documents.length });
}

/**
 * GET /documents/:id
 */
export function getDocument(
  _request: IncomingMessage,
  response: ServerResponse,
  params: Record<string, string>,
): void {
  const document = findDocument(params['id'], response);
  if (!document) {
    return;
  }

  sendJson(response, 200, toDocumentResponse(document));
}

/**
 * GET /documents/:id/status
 */
export function getDocumentStatus(
  _request: IncomingMessage,
  response: ServerResponse,
  params: Record<string, string>,
): void {
  const document = findDocument(params['id'], response);
  if (!document) {
    return;
  }

  const body: DocumentStatusResponse = {
    id: document.id,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    error: document.error,
  };
  sendJson(response, 200, body);
}

/**
 * GET /documents/:id/text
 */
export function getDocumentText(
  _request: IncomingMessage,
  response: ServerResponse,
  params: Record<string, string>,
): void {
  const document = findDocument(params['id'], response);
  if (!document) {
    return;
  }

  if (document.status === 'pending' || document.status === 'processing') {
    sendError(response, 409, 'Conflict', `Text is not available yet (status: ${document.status})`);
    return;
  }

  if (document.status === 'failed') {
    sendError(response, 409, 'Conflict', document.error ?? 'Document processing failed');
    return;
  }

  const result = document.processingResult;
  // undefined means "never extracted" (non-PDF types); an empty string is valid text.
  if (!result || result.extractedText === undefined) {
    sendError(response, 404, 'Not Found', `No extracted text found for document ${document.id}`);
    return;
  }

  const body: DocumentTextResponse = {
    id: document.id,
    text: result.extractedText,
    numpages: result.numpages ?? 0,
    extractedAt: result.processedAt.toISOString(),
  };
  sendJson(response, 200, body);
}

/**
 * DELETE /documents/:id
 * Removes the S3 objects first, then the in-memory record: if S3 fails the
 * document stays visible and the request can be retried.
 */
export async function deleteDocument(
  _request: IncomingMessage,
  response: ServerResponse,
  params: Record<string, string>,
): Promise<void> {
  const document = findDocument(params['id'], response);
  if (!document) {
    return;
  }

  try {
    const { s3Bucket } = document;
    const keys = [document.s3Key, documentService.getExtractedTextKey(document.id)].filter(
      (key): key is string => typeof key === 'string',
    );

    if (s3Bucket && keys.length > 0) {
      await Promise.all(
        keys.map((key) => s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }))),
      );
    }

    documentService.deleteDocument(document.id);

    response.statusCode = 204;
    response.end();
  } catch (error) {
    console.error(`Failed to delete document ${document.id}:`, error);
    sendError(
      response,
      500,
      'Internal Server Error',
      'An error occurred while deleting the document',
    );
  }
}
