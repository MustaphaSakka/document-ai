/**
 * Helpers shared by the tests that talk to PostgreSQL.
 *
 * They live here rather than in the test files so that the SQL appears once.
 */

import { databasePool } from '../src/db.js';

/**
 * Overwrite a document's created_at.
 *
 * A row's creation time belongs to the database, so a test that needs documents
 * in a known order writes the timestamps directly. Mutating the object returned
 * by the service would no longer work: it is a copy, not a live record.
 */
export async function setCreatedAt(id: string, createdAt: Date): Promise<void> {
  await databasePool.query('UPDATE documents SET created_at = $2 WHERE id = $1', [id, createdAt]);
}
