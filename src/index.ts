/**
 * Main entry point for the document processing application
 *
 * This is a minimal starting point that will evolve into a document
 * processing application using AWS services (S3, Textract, Bedrock).
 */

import 'dotenv/config';
import { startServer } from './server.js';

const PORT = 3000;

startServer(PORT);
