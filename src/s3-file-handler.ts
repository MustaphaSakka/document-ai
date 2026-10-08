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
  /** HTTP status the caller should answer with, when the failure maps to one. */
  statusCode?: number;
}

/** Single source of truth for the upload size limit: also used as the busboy fileSize limit. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
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
  let tooLarge = false;

  const payloadTooLarge = (): S3UploadError => ({
    error: 'Payload Too Large',
    message: `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    statusCode: 413,
  });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const stopReading = (): void => {
      const streamWithDestroy = fileStream as unknown as { destroy?: (error?: Error) => void };
      streamWithDestroy.destroy?.();
    };

    // busboy truncates the stream instead of failing when its fileSize limit is
    // reached, so 'limit' is the only signal that the file is too large.
    fileStream.on('limit', () => {
      tooLarge = true;
      stopReading();
      resolve(payloadTooLarge());
    });

    // Handle file data chunks
    fileStream.on('data', (chunk: Buffer) => {
      if (tooLarge) {
        return;
      }

      receivedBytes += chunk.length;
      chunks.push(chunk);

      // Defensive guard: the stream itself is also bounded by the caller
      if (receivedBytes > MAX_FILE_SIZE) {
        tooLarge = true;
        stopReading();
        resolve(payloadTooLarge());
      }
    });

    // Handle file stream completion
    fileStream.on('end', () => {
      // A truncated file must never be uploaded
      if (tooLarge) {
        return;
      }

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
