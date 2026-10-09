/**
 * Runs once for the whole suite, in its own process, before any test file.
 *
 * Applying the migrations here rather than in each file matches how the
 * application is deployed: the schema is a deliberate step that happens once,
 * not something every worker repeats.
 */

import { TEST_DATABASE_URL } from './config.js';

export async function setup(): Promise<void> {
  // This process is not a test worker, so it does not receive `test.env` from
  // vitest.config.ts: the connection string has to be put into the environment
  // before src/db.ts is loaded, which is why the imports below are dynamic.
  // They would otherwise be hoisted above this line and read DATABASE_URL too
  // early.
  process.env['DATABASE_URL'] = TEST_DATABASE_URL;

  const { closeDatabase, databaseName, verifyDatabaseConnection } = await import('../src/db.js');
  const { runMigrations } = await import('../src/migrate.js');

  // The suite empties tables, so the name is checked before anything else runs:
  // this is the error a mistyped DATABASE_URL should produce, clearly, rather
  // than a wipe of the development database.
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `The test suite only runs against a database whose name ends with "_test", ` +
        `but DATABASE_URL points at "${databaseName}".`,
    );
  }

  await verifyDatabaseConnection();
  await runMigrations();

  // This process has its own pool, separate from the workers': it has to
  // release its connections or Vitest never exits.
  await closeDatabase();
}
