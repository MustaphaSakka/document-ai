/**
 * File Handler
 * Handles file streaming and validation for document uploads
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface FileUploadResult {
  filename: string;
  filepath: string;
  size: number;
  mimetype: string;
}

export interface FileUploadError {
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
 * Stream file to temporary storage with validation
 */
export async function streamFileToFile(
  fileStream: NodeJS.ReadableStream,
  filename: string,
  mimetype: string,
): Promise<FileUploadResult | FileUploadError> {
  // Validate mimetype
  if (!isValidMimeType(mimetype)) {
    return {
      error: 'Invalid File Type',
      message: `File type ${mimetype} is not allowed`,
    };
  }

  // Generate unique filename
  const fileId = randomUUID();
  const extension = path.extname(filename) || '.bin';
  const tempFilename = `${fileId}${extension}`;
  const filepath = path.join('temp', tempFilename);

  // Ensure temp directory exists
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp', { recursive: true });
  }

  let receivedBytes = 0;
  let fileSize = 0;

  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filepath);

    // Handle file data chunks
    fileStream.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length;

      // Check file size limit
      if (receivedBytes > MAX_FILE_SIZE) {
        const readableStream = fileStream as unknown as { destroy: (error?: Error) => void };
        readableStream.destroy();
        writeStream.destroy();
        fs.unlinkSync(filepath); // Clean up partial file

        resolve({
          error: 'File Too Large',
          message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
        return;
      }
    });

    // Handle file stream completion
    fileStream.on('end', () => {
      fileSize = receivedBytes;
      writeStream.end();
    });

    // Handle write stream completion
    writeStream.on('finish', () => {
      resolve({
        filename,
        filepath,
        size: fileSize,
        mimetype,
      });
    });

    // Handle errors
    fileStream.on('error', (error: Error) => {
      const writableStream = writeStream as unknown as { destroy: (error?: Error) => void };
      writableStream.destroy();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(error);
    });

    writeStream.on('error', (error) => {
      const readableStream = fileStream as unknown as { destroy: (error?: Error) => void };
      readableStream.destroy();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(error);
    });

    // Pipe the streams
    fileStream.pipe(writeStream);
  });
}
