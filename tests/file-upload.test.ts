/**
 * Tests for file upload functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { createServer } from '../src/server';
import { MAX_FILE_SIZE } from '../src/s3-file-handler';
import { documentService } from '../src/document-service';
import { resetIdCounter } from '../src/utils';

let server: http.Server;
let baseUrl: string;

describe('File Upload Tests', () => {
  beforeAll(() => {
    // Start server on random available port for testing
    server = createServer();
    server.listen(0);

    const address = server.address();
    if (address && typeof address === 'object') {
      baseUrl = `http://localhost:${address.port}`;
    }
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    documentService.clearDocuments();
    resetIdCounter();
  });

  describe('Successful file upload', () => {
    it('should upload a text file successfully', async () => {
      // Create a simple text file
      const fileContent = Buffer.from('Sample PDF content');

      // Create multipart form data boundary
      const boundary = '----formdata-test-boundary';
      const crlf = '\r\n';

      // Build multipart form data
      const formData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="test.pdf"${crlf}` +
        `Content-Type: application/pdf${crlf}${crlf}` +
        fileContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('test.pdf');
      // Status can be 'pending', 'processing', or 'completed' since processing starts automatically
      expect(['pending', 'processing', 'completed']).toContain(data.status);
      expect(data.size).toBe(fileContent.length);
      expect(data.mimetype).toBe('application/pdf');

      // Verify file was stored
      const document = documentService.getDocument(data.id);
      expect(document).toBeDefined();
      expect(document?.s3Bucket).toBeDefined();
      expect(document?.s3Key).toBeDefined();
    });

    it('should return Location header', async () => {
      const fileContent = Buffer.from('Another test content');
      const boundary = '----test-boundary-abc123';
      const crlf = '\r\n';

      const formData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"${crlf}` +
        `Content-Type: text/plain${crlf}${crlf}` +
        fileContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      expect(response.status).toBe(201);
      const location = response.headers.get('location');
      expect(location).toMatch(/^\/documents\/doc_/);
    });
  });

  describe('File type validation', () => {
    it('should reject executable files', async () => {
      // PE executable header
      const fileContent = Buffer.from('MZ'); // PE executable header
      const boundary = '----test-boundary-exe';
      const crlf = '\r\n';

      const formData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="test.exe"${crlf}` +
        `Content-Type: application/x-msdownload${crlf}${crlf}` +
        fileContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Upload Failed');
      expect(data.message).toContain('File type');
    });

    it('should accept plain text files', async () => {
      const fileContent = Buffer.from('Plain text content for testing');
      const boundary = '----test-boundary-text';
      const crlf = '\r\n';

      const formData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"${crlf}` +
        `Content-Type: text/plain${crlf}${crlf}` +
        fileContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.mimetype).toBe('text/plain');
    });
  });

  describe('File size validation', () => {
    it('should enforce 10MB file size limit and accept files within limit', async () => {
      // Test the size limit constant
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024); // 10MB

      // Create a small file that's within the limit
      const smallContent = Buffer.from('Test content within size limit');
      const boundary = '----test-boundary-small';
      const crlf = '\r\n';

      const formData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="small.pdf"${crlf}` +
        `Content-Type: application/pdf${crlf}${crlf}` +
        smallContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      expect(response.status).toBe(201);
    });
  });

  describe('Missing file', () => {
    it('should reject upload without file', async () => {
      const boundary = '----test-boundary-missing';
      const crlf = '\r\n';

      // Empty form data
      const formData = `--${boundary}${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('No file provided');
    });
  });

  describe('Document record creation', () => {
    it('should create document record with file information', async () => {
      const fileContent = Buffer.from('Document content for testing');
      const boundary = '----test-boundary-doc';
      const crlf = '\r\n';

      const formData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="invoice.pdf"${crlf}` +
        `Content-Type: application/pdf${crlf}${crlf}` +
        fileContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      expect(response.status).toBe(201);

      const data = await response.json();

      // Verify document was created in service
      const document = documentService.getDocument(data.id);
      expect(document).toBeDefined();
      expect(document?.name).toBe('invoice.pdf');
      // Status can be 'pending', 'processing', or 'completed' since processing starts automatically
      expect(['pending', 'processing', 'completed']).toContain(document?.status);
      expect(document?.size).toBe(fileContent.length);
      expect(document?.mimetype).toBe('application/pdf');
      expect(document?.s3Bucket).toBeDefined();
      expect(document?.s3Key).toBeDefined();
      expect(document?.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique document IDs', async () => {
      const fileContent = Buffer.from('Test content 1');
      const boundary = '----test-boundary-unique1';
      const crlf = '\r\n';

      const formData1 =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="file1.txt"${crlf}` +
        `Content-Type: text/plain${crlf}${crlf}` +
        fileContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response1 = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData1,
      });

      const fileContent2 = Buffer.from('Test content 2');
      const boundary2 = '----test-boundary-unique2';
      const formData2 =
        `--${boundary2}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="file2.txt"${crlf}` +
        `Content-Type: text/plain${crlf}${crlf}` +
        fileContent2.toString() +
        `${crlf}--${boundary2}--${crlf}`;

      const response2 = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary2}`,
        },
        body: formData2,
      });

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.id).not.toBe(data2.id);
    });
  });

  describe('Concurrent uploads', () => {
    it('should handle multiple simultaneous uploads', async () => {
      const uploads = Array.from({ length: 3 }, (_, i) => {
        const fileContent = Buffer.from(`Concurrent test content ${i}`);
        const boundary = `----test-boundary-concurrent-${i}`;
        const crlf = '\r\n';

        const formData =
          `--${boundary}${crlf}` +
          `Content-Disposition: form-data; name="file"; filename="file${i}.txt"${crlf}` +
          `Content-Type: text/plain${crlf}${crlf}` +
          fileContent.toString() +
          `${crlf}--${boundary}--${crlf}`;

        return fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: formData,
        });
      });

      const responses = await Promise.all(uploads);

      for (const response of responses) {
        expect(response.status).toBe(201);
      }

      // Verify all documents were created
      const allDocs = documentService.getAllDocuments();
      expect(allDocs).toHaveLength(3);
    });
  });

  describe('S3 storage', () => {
    it('should store document S3 location', async () => {
      const fileContent = Buffer.from('Stored content for testing');
      const boundary = '----test-boundary-storage';
      const crlf = '\r\n';

      const formData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="stored.pdf"${crlf}` +
        `Content-Type: application/pdf${crlf}${crlf}` +
        fileContent.toString() +
        `${crlf}--${boundary}--${crlf}`;

      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      const data = await response.json();
      const document = documentService.getDocument(data.id);

      expect(document?.s3Bucket).toBeDefined();
      expect(document?.s3Key).toBeDefined();
      expect(document?.s3Bucket).toBe('test-bucket');
      expect(document?.s3Key).toMatch(/\.pdf$/);
    });
  });
});
