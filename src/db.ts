/**
 * PostgreSQL connection pool.
 *
 * The pool is created once, at import time, and shared by the whole process.
 * Opening a connection is expensive, so `pg` keeps a few of them open and hands
 * one to each query; concurrent requests therefore do not each pay that cost.
 * Every query is asynchronous — unlike the Map this replaces, there is no
 * synchronous read — which is why callers await these functions.
 */

import { Pool } from 'pg';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

function parseDatabaseName(url: string): string {
  let pathname: string;
  try {
    // `pathname` drops the query string, so `?sslmode=require` does not end up
    // in the name. The leading slash is part of the URL, not of the name.
    pathname = new URL(url).pathname;
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL');
  }
  return decodeURIComponent(pathname.replace(/^\//, ''));
}

/** Name of the database in DATABASE_URL, e.g. `document_ai_test`. */
export const databaseName = parseDatabaseName(databaseUrl);

export const databasePool = new Pool({ connectionString: databaseUrl });

/**
 * Fails fast when the database is unreachable, instead of letting the first
 * request discover it. Call this before accepting connections.
 */
export async function verifyDatabaseConnection(): Promise<void> {
  await databasePool.query('SELECT 1');
}

/**
 * Closes every pooled connection. The process cannot exit while connections are
 * open, so this runs on shutdown and at the end of the test suite.
 */
export async function closeDatabase(): Promise<void> {
  await databasePool.end();
}

/**
 * Guard for destructive statements — TRUNCATE, a DELETE without a WHERE, DROP.
 *
 * The suite erases every row between tests, so it calls this first: a mistyped
 * DATABASE_URL then fails loudly instead of emptying a database that is not a
 * test one. The rule is the `_test` suffix and nothing else, because a name is
 * the only thing a connection string reliably tells us.
 */
export function assertTestDatabase(): void {
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run a destructive operation on database "${databaseName}": ` +
        'its name must end with "_test". Check DATABASE_URL.',
    );
  }
}
