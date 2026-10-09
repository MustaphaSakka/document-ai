/**
 * The single place where the test suite's database is decided.
 *
 * Both vitest.config.ts (which hands it to the test files) and
 * tests/global-setup.ts (which runs in its own process, before the files, and
 * never sees `test.env`) read it from here, so the two cannot drift apart.
 *
 * These are the local container's throwaway credentials from
 * docker-compose.yml, not secrets. The name must end with _test: the suite
 * empties the documents table between tests, and tests/global-setup.ts refuses
 * to start against anything else.
 */

export const TEST_DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://document_ai:document_ai@localhost:5432/document_ai_test';
