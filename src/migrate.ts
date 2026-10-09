/**
 * Migration runner.
 *
 * Applies the `.sql` files in `db/migrations` in filename order, each inside its
 * own transaction, and records what it applied in `schema_migrations`. A file
 * already listed there is skipped, so running this twice changes nothing.
 *
 *   npm run migrate
 *
 * Migrations are never applied as a side effect of starting the server: a schema
 * change should be a deliberate step, not something a restart does for you.
 */

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { closeDatabase, databasePool } from './db.js';

// Resolved from the working directory rather than from this file's location:
// `npm run migrate` always runs from the project root, whereas this module ends
// up in `dist/` after a build and would then look for migrations in the wrong
// place if it navigated relative to itself.
const MIGRATIONS_DIRECTORY = path.resolve(process.cwd(), 'db', 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await databasePool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedVersions(): Promise<Set<string>> {
  const { rows } = await databasePool.query<{ version: string }>(
    'SELECT version FROM schema_migrations',
  );
  return new Set(rows.map((row) => row.version));
}

async function listMigrationFiles(): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(MIGRATIONS_DIRECTORY);
  } catch {
    throw new Error(
      `Cannot read ${MIGRATIONS_DIRECTORY} — run this from the project root: npm run migrate`,
    );
  }
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

/**
 * One migration, one transaction: either the whole file applies and is recorded,
 * or the database is left exactly as it was. Statements sent as a single string
 * with no parameters run through the simple query protocol, which accepts
 * several of them separated by semicolons.
 */
async function applyMigration(version: string, sql: string): Promise<void> {
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Applies whatever is pending and returns the versions it applied. */
export async function runMigrations(): Promise<string[]> {
  await ensureMigrationsTable();
  const applied = await getAppliedVersions();
  const files = await listMigrationFiles();
  const newlyApplied: string[] = [];

  for (const file of files) {
    const version = path.basename(file, '.sql');
    if (applied.has(version)) {
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIRECTORY, file), 'utf8');
    await applyMigration(version, sql);
    newlyApplied.push(version);
    console.log(`applied ${version}`);
  }

  return newlyApplied;
}

// `import.meta.url` is the file being executed; `process.argv[1]` is the script
// the CLI was asked to run. They match only when this module is the entry point,
// so importing `runMigrations` from a test does not migrate anything.
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    const applied = await runMigrations();
    console.log(
      applied.length === 0
        ? 'Database is up to date; nothing to apply.'
        : `Applied ${applied.length} migration(s).`,
    );
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
