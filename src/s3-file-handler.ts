/**
 * S3 File Handler
 * Handles streaming file uploads directly to AWS S3
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from './s3-client.js';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export interface S3UploadResult {
  filename: string;
  s3Bucket: string;
  s3Key: string;
  size: number;
  mimetype: string;
}

export interface S3UploadError {
  error: string;
  message: string;
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain',
];

/**
 * Validate file type
 */
function isValidMimeType(mimetype: string): boolean {
  return ALLOWED_MIMETYPES.includes(mimetype);
}

/**
 * Stream file upload to S3
 */
export async function streamFileToS3(
  fileStream: NodeJS.ReadableStream,
  filename: string,
  mimetype: string,
): Promise<S3UploadResult | S3UploadError> {
  // Validate mimetype
  if (!isValidMimeType(mimetype)) {
    return {
      error: 'Invalid File Type',
      message: `File type ${mimetype} is not allowed`,
    };
  }

  // Generate unique S3 key with documents/ prefix
  const fileId = randomUUID();
  const extension = path.extname(filename) || '.bin';
  const s3Key = `documents/${fileId}${extension}`;

  let receivedBytes = 0;
  let fileSize = 0;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    // Handle file data chunks
    fileStream.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;
      chunks.push(chunk);

      // Check file size limit
      if (receivedBytes > MAX_FILE_SIZE) {
        // Try to destroy the stream, but don't fail if it doesn't exist
        const streamWithDestroy = fileStream as unknown as { destroy: (error?: Error) => void };
        if (streamWithDestroy.destroy) {
          streamWithDestroy.destroy(new Error('File size exceeds maximum allowed size'));
        }
        reject(new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`));
        return;
      }
    });

    // Handle file stream completion
    fileStream.on('end', () => {
      fileSize = receivedBytes;

      void (async (): Promise<void> => {
        try {
          // Upload to S3
          console.log(`Uploading to S3: Bucket=${BUCKET_NAME}, Key=${s3Key}`);
          await s3Client.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: s3Key,
              Body: Buffer.concat(chunks),
              ContentType: mimetype,
            })
          );
          console.log(`S3 upload successful: ${s3Key}`);

          resolve({
            filename,
            s3Bucket: BUCKET_NAME,
            s3Key,
            size: fileSize,
            mimetype,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown S3 upload error';
          reject(new Error(`Failed to upload to S3: ${errorMessage}`));
        }
      })();
    });

    // Handle errors
    fileStream.on('error', (error: Error) => {
      reject(error);
    });
  });
}
