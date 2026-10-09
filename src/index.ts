/**
 * Main entry point for the document processing application
 *
 * This is a minimal starting point that will evolve into a document
 * processing application using AWS services (S3, Bedrock).
 */

import 'dotenv/config';
import { closeDatabase, verifyDatabaseConnection } from './db.js';
import { startServer } from './server.js';

const PORT = 3000;

/**
 * pg reports an unreachable host as an AggregateError whose own message is
 * empty, with the real one (ECONNREFUSED, ENOTFOUND, ...) in its `errors`.
 * Without this the startup message would read "Cannot reach PostgreSQL: ".
 */
function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    return error.errors.map(describeError).join('; ');
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return String(error);
}

// Check the database before binding the port, so a misconfigured DATABASE_URL
// is reported here rather than by whichever request happens to arrive first.
try {
  await verifyDatabaseConnection();
} catch (error) {
  console.error('Cannot reach PostgreSQL:', describeError(error));
  await closeDatabase();
  process.exit(1);
}

startServer(PORT);
