/**
 * Textract Processor
 * Handles async text detection with AWS Textract
 */

import {
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
} from '@aws-sdk/client-textract';
import { textractClient } from './textract-client.js';

/**
 * Textract job status
 */
export type TextractJobStatus = 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL_SUCCESS';

/**
 * Textract response types (minimal subset we need)
 */
interface TextractBlock {
  BlockType: string;
  Text?: string;
}

interface GetDocumentTextDetectionResponse {
  JobStatus: TextractJobStatus;
  StatusMessage?: string;
  Blocks?: TextractBlock[];
  NextToken?: string;
}

/**
 * Start async text detection for a document in S3
 */
export async function startTextDetection(
  s3Bucket: string,
  s3Key: string,
): Promise<string> {
  const response = await textractClient.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
    })
  );

  if (!response.JobId) {
    throw new Error('Textract did not return a JobId');
  }

  return response.JobId;
}

/**
 * Poll for text detection results
 * Uses fixed-interval polling with timeout
 */
export async function pollTextDetection(
  jobId: string,
  pollIntervalMs = 2000,
  maxAttempts = 30, // 60 seconds max
): Promise<GetDocumentTextDetectionResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await textractClient.send(
      new GetDocumentTextDetectionCommand({
        JobId: jobId,
      })
    );

    // Handle the case where JobStatus might be undefined (AWS SDK returns undefined)
    if (!response.JobStatus) {
      throw new Error(`Textract returned undefined JobStatus for job ${jobId}`);
    }

    if (response.JobStatus === 'SUCCEEDED' || response.JobStatus === 'FAILED' || response.JobStatus === 'PARTIAL_SUCCESS') {
      return response as GetDocumentTextDetectionResponse;
    }

    // Still in progress, wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Textract job ${jobId} did not complete within ${maxAttempts * pollIntervalMs}ms`);
}

/**
 * Extract text from Textract blocks
 */
export function extractTextFromBlocks(blocks?: TextractBlock[]): string {
  if (!blocks) {
    return '';
  }

  // Filter for LINE blocks and extract their text
  const lines = blocks
    .filter(block => block.BlockType === 'LINE' && block.Text)
    .map(block => block.Text!)
    .filter(text => text.trim().length > 0);

  return lines.join('\n');
}
