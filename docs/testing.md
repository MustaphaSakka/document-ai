# Testing

Two independent suites. Neither needs the other: the backend suite runs without a browser,
the frontend suite runs without a backend and without a database.

| Suite | Tool | Location | Run from | Size | Needs |
|---|---|---|---|---|---|
| Backend unit and integration | Vitest | `tests/` | repository root | 11 files, 130 tests | PostgreSQL |
| Frontend end-to-end | Cypress | `frontend/cypress/e2e/` | `frontend/` | 5 specs, 18 tests | — |

## Backend (Vitest)

```bash
npm run db:up           # PostgreSQL, required
npx vitest run          # one pass
npm test                # watch mode
npm run test:coverage   # with a coverage report
```

`npm run db:up` is the only preparation: the suite creates its own database contents, applying
the migrations and emptying the table between tests.

### Layout

```
tests/
├── setup.ts                    per-file setup: mocks the AWS SDK
├── config.ts                   the test DATABASE_URL, decided in one place
├── global-setup.ts             once per suite: checks the name, applies the migrations
├── db.ts                       helpers for the tests that talk to PostgreSQL
├── example.test.ts             sanity checks on the toolchain
├── server.test.ts              routing, dispatch, 404s
├── document-management.test.ts the /documents endpoints end to end
├── file-upload.test.ts         multipart parsing, size and mime-type validation
├── document-service.test.ts    status transitions, id generation
├── processor.test.ts           background processing, success and failure
├── pdf-extraction.test.ts      the pdf2json wrapper and text statistics
├── persistence.test.ts         state lives in PostgreSQL, not in the service
├── database-errors.test.ts     what the API answers when PostgreSQL is unreachable
├── test-database-guard.test.ts the `_test` suffix guard on destructive statements
└── lambda-processor.test.ts    the Lambda handler and its event validation
```

### Configuration

`vitest.config.ts` sets `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `NODE_ENV=test` and `DATABASE_URL`
for the suite, loads `tests/setup.ts`, and runs `tests/global-setup.ts`.

`tests/setup.ts` replaces `@aws-sdk/client-s3` with `vi.mock`, so no test reaches AWS:
`GetObjectCommand` returns an in-memory stream and every other command succeeds silently. That is
why the suite needs no credentials and no network. The mock lives in one place on purpose: tests
exercise the same code as production, and only the network boundary is replaced.

PostgreSQL is the one collaborator that is **not** mocked. The suite runs against a real
database, because the SQL and the round trip through it are what most of these tests are about.

- `tests/config.ts` holds the connection string — the single place `vitest.config.ts` and
  `tests/global-setup.ts` both read it from, so the two cannot drift apart. It defaults to
  `document_ai_test` on the local container.
- `tests/global-setup.ts` runs once, in its own process, before any test file. It refuses to run
  unless the database name ends in `_test`, then applies the migrations. It closes its own pool
  afterwards, or Vitest would never exit.
- `fileParallelism` is off. Every file shares one database and empties it between tests, so
  running files in parallel would have them deleting each other's rows.
- `tests/persistence.test.ts` is the one that proves persistence rather than assuming it: it
  reads through a second pool and a second `DocumentService`, neither of which the application's
  service has ever seen. The old in-memory `Map` could not have passed it.

### Conventions

- One `*.test.ts` per module, named after it, in `tests/`.
- `describe` names the unit; `it` states the behaviour in plain words
  (`it('rejects a file larger than 5 MB')`).
- Assert on observable results — status codes, returned objects, thrown errors — rather than
  on internal calls, unless the call *is* the contract.
- Tests must be independent. `document-service.ts` exports a singleton holding the shared pool,
  so reset state in `beforeEach` — `documentService.clearDocuments()` empties the table — rather
  than relying on file order. That call is what the `_test` guard exists to make safe.

## Frontend (Cypress)

```bash
npm run test:e2e      # starts the dev server, runs headless, stops it
npm run cypress:open  # interactive runner
npm run cypress:run   # headless, against an already-running server
```

One spec per feature: `documents-list`, `document-upload`, `document-detail`, `document-text`,
`document-delete`.

Every spec stubs the API with `cy.intercept` and fixtures from `cypress/fixtures/`. The suite
therefore never needs the backend, and it can produce states a real backend rarely reaches on
demand: a 500, a 404, a document that stays `pending`, a status that flips to `completed`
mid-test.

What gets asserted is what the user sees — text on screen, rows in the table, a message after
a failed request — never component internals or Vue state.

### Tests that involve timing

Two tests cover the automatic status refresh: one waits for a row to move from `processing` to
`completed`, the other asserts that no further requests are sent once nothing is left to
process. Both rely on `cy.intercept` counters to control what the server "returns" on each
call, and on a `{ timeout }` on the assertion that waits. Prefer waiting for a condition over
a fixed `cy.wait(milliseconds)`; when a fixed pause is unavoidable, comment why it is longer
than the interval it is testing.

The rules for writing these tests — stubbing, choosing behaviour over implementation,
accessibility checks — are in
[frontend-conventions.md](frontend-conventions.md#cypress).
