-- Runs once, when the container initialises an empty data directory.
--
-- The test suite deletes rows between tests, so it gets a database of its own:
-- a mistyped DATABASE_URL then cannot touch development data. The `_test`
-- suffix is what src/db.ts checks for before allowing a destructive statement.

CREATE DATABASE document_ai_test OWNER document_ai;
