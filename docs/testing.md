# Testing

Two independent suites. Neither needs the other: the backend suite runs without a browser,
the frontend suite runs without a backend.

| Suite | Tool | Location | Run from | Size |
|---|---|---|---|---|
| Backend unit and integration | Vitest | `tests/` | repository root | 8 files, 100 tests |
| Frontend end-to-end | Cypress | `frontend/cypress/e2e/` | `frontend/` | 5 specs, 18 tests |

## Backend (Vitest)

```bash
npx vitest run          # one pass
npm test                # watch mode
npm run test:coverage   # with a coverage report
```

### Layout

```
tests/
├── setup.ts                    global setup: mocks the AWS SDK
├── example.test.ts             sanity checks on the toolchain
├── server.test.ts              routing, dispatch, 404s
├── document-management.test.ts the /documents endpoints end to end
├── file-upload.test.ts         multipart parsing, size and mime-type validation
├── document-service.test.ts    status transitions, id generation
├── processor.test.ts           background processing, success and failure
├── pdf-extraction.test.ts      the pdf2json wrapper and text statistics
└── lambda-processor.test.ts    the Lambda handler and its event validation
```

### Configuration

`vitest.config.ts` sets `AWS_REGION`, `AWS_S3_BUCKET_NAME` and `NODE_ENV=test` for the suite
and loads `tests/setup.ts`. That file replaces `@aws-sdk/client-s3` with `vi.mock`, so no test
reaches AWS: `GetObjectCommand` returns an in-memory stream and every other command succeeds
silently. That is why the whole suite runs in about a second, with no credentials.

The mock lives in one place on purpose: tests exercise the same code as production, and only
the network boundary is replaced.

### Conventions

- One `*.test.ts` per module, named after it, in `tests/`.
- `describe` names the unit; `it` states the behaviour in plain words
  (`it('rejects a file larger than 5 MB')`).
- Assert on observable results — status codes, returned objects, thrown errors — rather than
  on internal calls, unless the call *is* the contract.
- Tests must be independent. `document-service.ts` exports a singleton, so reset state in
  `beforeEach` instead of relying on file order.

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
