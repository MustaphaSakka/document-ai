/**
 * Textract Client
 * AWS Textract client for document text detection
 */

import { TextractClient } from '@aws-sdk/client-textract';

// Validate required environment variables
const region = process.env['AWS_REGION'];

if (!region) {
  throw new Error('AWS_REGION environment variable is required');
}

/**
 * Textract client instance
 */
export const textractClient = new TextractClient({
  region,
  // Credentials are automatically loaded from environment by AWS SDK
});
