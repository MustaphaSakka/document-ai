/**
 * Tests for Lambda PDF processor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handler,
  validateS3Event,
  type S3Event,
} from '../src/lambda/pdf-processor';
import { Readable } from 'node:stream';

// Mock AWS SDK S3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = vi.fn().mockImplementation(async (command: any) => {
      // Handle GetObjectCommand
      if (command.constructor.name === 'GetObjectCommand') {
        return {
          $metadata: { httpStatusCode: 200 },
          Body: createMockStream('Sample PDF content for testing'),
        };
      }
      // Handle PutObjectCommand
      if (command.constructor.name === 'PutObjectCommand') {
        return {
          $metadata: { httpStatusCode: 200 },
          ETag: '"mock-etag"',
        };
      }
      return {
        $metadata: { httpStatusCode: 200 },
      };
    });
  },
  GetObjectCommand: class {
    constructor(public input: any) {}
  },
  PutObjectCommand: class {
    constructor(public input: any) {}
  },
}));

// Mock pdf2json
vi.mock('pdf2json', () => ({
  default: class MockPDFParser {
    on = vi.fn((event: string, handler: any) => {
      // Automatically trigger successful parsing
      if (event === 'pdfParser_dataReady') {
        setTimeout(() => {
          handler({
            Pages: [
              {
                Texts: [
                  {
                    R: [
                      { T: 'Sample PDF content for testing' }
                    ]
                  }
                ]
              },
              {
                Texts: [
                  {
                    R: [
                      { T: 'Second page content' }
                    ]
                  }
                ]
              }
            ],
            Meta: {
              PDFFormatVersion: '1.4',
              Author: 'Test Author'
            }
          });
        }, 10);
      }
    });
    parseBuffer = vi.fn();
  },
}));

// Mock s3Client from our own module
vi.mock('../src/s3-client.js', () => ({
  s3Client: {
    send: vi.fn().mockImplementation(async (command: any) => {
      // Handle GetObjectCommand
      if (command.constructor.name === 'GetObjectCommand') {
        return {
          $metadata: { httpStatusCode: 200 },
          Body: createMockStream('Sample PDF content for testing'),
        };
      }
      // Handle PutObjectCommand
      if (command.constructor.name === 'PutObjectCommand') {
        return {
          $metadata: { httpStatusCode: 200 },
          ETag: '"mock-etag"',
        };
      }
      return {
        $metadata: { httpStatusCode: 200 },
      };
    }),
  },
  BUCKET_NAME: 'test-bucket',
}));

function createMockStream(content: string) {
  const stream = new Readable();
  stream._read = () => {};
  stream.push(content);
  stream.push(null);
  return stream;
}

describe('Lambda PDF Processor', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('validateS3Event', () => {
    it('should validate correct S3 event structure', () => {
      const validEvent: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:00Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: { principalId: 'AIDAJDPLRKVLX' },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'documents/test-file.pdf',
                size: 1024,
                eTag: '"test-etag"',
                sequencer: '005FFFFA',
              },
            },
          },
        ],
      };

      expect(validateS3Event(validEvent)).toBe(true);
    });

    it('should reject event without Records array', () => {
      const invalidEvent = { Records: 'not an array' };

      expect(validateS3Event(invalidEvent)).toBe(false);
    });

    it('should reject event with empty Records', () => {
      const invalidEvent: S3Event = { Records: [] };

      expect(validateS3Event(invalidEvent)).toBe(false);
    });

    it('should reject event with missing s3 object', () => {
      const invalidEvent = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:00Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            // @ts-expect-error - testing invalid structure
            s3: null,
          },
        ],
      };

      expect(validateS3Event(invalidEvent)).toBe(false);
    });

    it('should reject event with missing bucket name', () => {
      const invalidEvent = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:00Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                // @ts-expect-error - testing invalid structure
                name: null,
                ownerIdentity: { principalId: 'AIDAJDPLRKVLX' },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'documents/test-file.pdf',
                size: 1024,
                eTag: '"test-etag"',
                sequencer: '005FFFFA',
              },
            },
          },
        ],
      };

      expect(validateS3Event(invalidEvent)).toBe(false);
    });
  });

  describe('handler', () => {
    it('should process valid S3 event successfully', async () => {
      const validEvent: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:00Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: { principalId: 'AIDAJDPLRKVLX' },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'documents/abc123-def456-ghi789.pdf',
                size: 1024,
                eTag: '"test-etag"',
                sequencer: '005FFFFA',
              },
            },
          },
        ],
      };

      const result = await handler(validEvent);

      expect(result.statusCode).toBe(200);
      expect(result.processedFiles).toContain('documents/abc123-def456-ghi789.pdf');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple files in single event', async () => {
      const multiFileEvent: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:00Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: { principalId: 'AIDAJDPLRKVLX' },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'documents/file1.pdf',
                size: 1024,
                eTag: '"test-etag"',
                sequencer: '005FFFFA',
              },
            },
          },
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:01Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: { principalId: 'AIDAJDPLRKVLX' },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'documents/file2.pdf',
                size: 2048,
                eTag: '"test-etag2"',
                sequencer: '005FFFFB',
              },
            },
          },
        ],
      };

      const result = await handler(multiFileEvent);

      expect(result.statusCode).toBe(200);
      expect(result.processedFiles).toHaveLength(2);
      expect(result.processedFiles).toContain('documents/file1.pdf');
      expect(result.processedFiles).toContain('documents/file2.pdf');
    });

    it('should handle PDF extraction errors gracefully', async () => {
      const { s3Client } = await import('../src/s3-client.js');
      const mockSend = vi.mocked(s3Client.send);

      // Mock GetObject to return error
      mockSend.mockRejectedValueOnce(new Error('S3 access denied'));

      const errorEvent: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:00Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: { principalId: 'AIDAJDPLRKVLX' },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'documents/error-file.pdf',
                size: 1024,
                eTag: '"test-etag"',
                sequencer: '005FFFFA',
              },
            },
          },
        ],
      };

      const result = await handler(errorEvent);

      expect(result.statusCode).toBe(500);
      expect(result.errors).toHaveLength(1);
      expect(result.processedFiles).toHaveLength(0);
    });

    it('should handle invalid S3 key format', async () => {
      const invalidKeyEvent: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'eu-west-3',
            eventTime: '2026-08-27T10:00:00Z',
            eventName: 'ObjectCreated:Put',
            userIdentity: { principalId: 'AIDAJDPLRKVLX' },
            requestParameters: { sourceIPAddress: '127.0.0.1' },
            responseElements: {
              'x-amz-request-id': '1234567890',
              'x-amz-id-2': 'abcdef123456',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: { principalId: 'AIDAJDPLRKVLX' },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'invalid-key-format.pdf',
                size: 1024,
                eTag: '"test-etag"',
                sequencer: '005FFFFA',
              },
            },
          },
        ],
      };

      const result = await handler(invalidKeyEvent);

      expect(result.statusCode).toBe(500);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid S3 key format');
    });
  });
});
