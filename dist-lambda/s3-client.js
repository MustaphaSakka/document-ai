"use strict";
/**
 * AWS S3 Client Configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUCKET_NAME = exports.s3Client = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
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
exports.s3Client = new client_s3_1.S3Client({
    region,
    // Credentials will be loaded from environment variables automatically
    // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
    // Or from IAM roles when running on AWS infrastructure
});
exports.BUCKET_NAME = bucketName;
