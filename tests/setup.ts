/**
 * Test setup configuration
 */

import { vi } from 'vitest';
import { Readable } from 'node:stream';

// Create a mock stream for S3 response body
function createMockStream(content: string) {
  const stream = new Readable();
  stream._read = () => {};
  stream.push(content);
  stream.push(null);
  return stream;
}

// Mock AWS SDK for testing
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = vi.fn().mockImplementation(async (command: any) => {
      // Check if this is a GetObjectCommand by inspecting the constructor name
      if (command.constructor.name === 'GetObjectCommand') {
        return {
          $metadata: { httpStatusCode: 200 },
          Body: createMockStream('Sample PDF content for testing'),
        };
      }
      // Default response for other commands
      return {
        $metadata: { httpStatusCode: 200 },
      };
    });
  },
  PutObjectCommand: class {
    constructor(public input: any) {}
  },
  GetObjectCommand: class {
    constructor(public input: any) {}
  },
}));
