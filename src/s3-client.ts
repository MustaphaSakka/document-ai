/**
 * AWS S3 Client Configuration
 */

import { S3Client } from '@aws-sdk/client-s3';

// Validate required environment variables
const region = process.env['AWS_REGION'];
const bucketName = process.env['AWS_S3_BUCKET_NAME'];

if (!region) {
  throw new Error('AWS_REGION environment variable is required');
}

if (!bucketName) {
  throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
}

// Create S3 client
export const s3Client = new S3Client({
  region,
  // Credentials will be loaded from environment variables automatically
  // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
  // Or from IAM roles when running on AWS infrastructure
});

export const BUCKET_NAME = bucketName;
