# Architecture

How the project is put together: the directories that matter, the layers, and what happens
between an upload and the extracted text.

- Endpoints and payloads: [api.md](api.md)
- Commands and configuration: [development.md](development.md)
- Frontend rules: [frontend-conventions.md](frontend-conventions.md)

## Two applications

| Part | Stack | Port | Entry point |
|---|---|---|---|
| Backend | Node.js + TypeScript (ESM) | 3000 | `src/index.ts` |
| Frontend | Vue 3 + Vite + TypeScript | 5173 | `frontend/src/main.ts` |

They are two separate npm projects, each with its own `package.json`, dependencies and
scripts. The browser only ever talks to port 5173: Vite proxies `/api/*` to
`http://localhost:3000`, stripping the `/api` prefix (`frontend/vite.config.ts`). Because the
browser sees a single origin, the backend needs no CORS configuration.

The `/api` prefix is not decorative: the frontend has a `/documents` page of its own, and a
proxy on plain `/documents` would intercept the page navigation instead of the API call.

## Backend layout

```
src/
├── index.ts                      entry point: loads .env, checks the database, starts the server
├── server.ts                     HTTP server, route table, dispatch to handlers
├── routes/
│   └── documents.ts              one handler per endpoint
├── db.ts                         shared pg Pool; the guard on destructive statements
├── migrate.ts                    applies db/migrations/*.sql (`npm run migrate`)
├── types/
│   └── document.ts               the domain types, shared across the backend
├── repositories/
│   └── document-repository.ts    every SQL statement that touches `documents`
├── document-service.ts           business rules and status transitions
├── processor.ts                  background processing of an uploaded document
├── extractors/
│   └── pdf-text-extractor.ts     pdf2json wrapper, text statistics
├── lambda/
│   └── pdf-processor.ts          AWS Lambda handler for S3 events (deployed separately)
├── s3-client.ts                  S3Client, reads AWS_REGION / AWS_S3_BUCKET_NAME
├── s3-file-handler.ts            upload validation, streaming to S3
└── utils.ts                      id generation
```

`src/lambda/pdf-processor.ts` is not part of the running API: it is a second entry point,
built with `tsconfig.lambda.json` and deployed to AWS. The API's own processing path is
`src/processor.ts`.

The schema itself is outside `src/`: `db/migrations/` holds the `.sql` files, `db/initdb/` the
script that creates the test database when the container's volume is first initialised, and
`docker-compose.yml` the container that runs both locally. `src/db.ts` holds the connection pool
every query goes through; `src/repositories/document-repository.ts` is the only file under `src/`
that writes SQL; `src/migrate.ts` is the runner ([development.md](development.md#database)).

### Layers

```
HTTP request
   │
   ▼
server.ts               route table: matches method + number of path segments
   │
   ▼
routes/documents.ts     HTTP concerns only: parse, validate, pick a status code
   │
   ├──► document-service.ts    business rules; knows nothing about HTTP, SQL or S3
   │      └──► document-repository.ts   the SQL; knows nothing about HTTP
   │             └──► db.ts             the connection pool
   └──► s3-file-handler.ts     S3 concerns; knows nothing about HTTP
```

Handlers translate between HTTP and those two collaborators. Business rules live in
`DocumentService`, the SQL in `DocumentRepository`, infrastructure behind `db.ts`, `s3-client.ts`
and `s3-file-handler.ts`; and `server.ts` knows nothing about documents.

The split between the service and the repository is the point: the service decides *what* should
happen (an id is generated, a name is trimmed, a status change to `completed` accompanies a
result) and the repository decides *how it is stored*. Swapping PostgreSQL for something else
would mean writing one new repository, not touching the service or the routes.

Routes are matched on the HTTP method **and the exact number of path segments**
(`src/server.ts`). That is what keeps `/documents/:id` from swallowing
`/documents/:id/status`.

### Document lifecycle

```
POST /documents
  → validate content type, size (5 MB), mime type
  → stream the file to S3
  → insert the row with status "pending"
  → 201 Created; processing continues in the background
       → "processing"
       → pdf2json extracts the text
       → "completed", or "failed" with an error message
```

The upload response does not wait for processing: it usually reports `pending`, and a fast
document may already be `processing` by the time the client reads it. The client follows
progress with `GET /documents/:id/status` — see
[api.md](api.md#get-documentsidstatus).

The record is written to PostgreSQL before the response is sent, so it outlives the process: a
document is still there after a restart, with its status and its processing result. The file
bytes stay in S3. Deleting a document removes the S3 objects first and the row second, which is
why a failed S3 call leaves the document visible and retryable — see
[api.md](api.md#delete-documentsid).

## Frontend layout

```
frontend/src/
├── main.ts                 createApp + router + styles
├── App.vue                 shell: header and router-view
├── router/index.ts         /documents, /documents/:id
├── views/                  one component per route
├── components/             presentational pieces: table, upload form, badge, alert
├── composables/            state and async logic: list, polling
├── api/                    fetch calls: client.ts (transport + errors), documents.ts (endpoints)
├── types/document.ts       types mirroring the API responses
├── utils/                  formatting and error-message helpers
├── vue-shims.d.ts          lets stock `tsc` resolve `*.vue` imports (the type-aware
│                           ESLint rules run through `tsc`, which cannot parse SFCs)
└── styles/main.css
```

Data flows one way: a view calls a composable, a composable calls `api/`, and `api/` is the
only place that knows about `fetch`, URLs and HTTP status codes. Components take props and
emit events; they never fetch. Examples and the reasoning are in
[frontend-conventions.md](frontend-conventions.md).

## Tests

```
tests/                      Vitest, backend — one file per module
frontend/cypress/e2e/       Cypress end-to-end — one spec per feature
```

See [testing.md](testing.md).

## Configuration files

| File | Purpose |
|---|---|
| `package.json` | Backend scripts and dependencies |
| `tsconfig.json` | Backend TypeScript: strict, ES2022, NodeNext, `src/` → `dist/` |
| `tsconfig.lambda.json` | TypeScript config for the Lambda handler |
| `eslint.config.js` | Backend ESLint (flat config) |
| `.prettierrc` | Formatting: single quotes, 100 columns, 2 spaces |
| `vitest.config.ts` | Test environment variables, `tests/setup.ts`, `tests/global-setup.ts` |
| `docker-compose.yml` | Local PostgreSQL, for development and for the test suite |
| `db/migrations/` | The schema, applied by `npm run migrate` |
| `db/initdb/` | Creates `document_ai_test` when the container's volume is first initialised |
| `.env` | `DATABASE_URL`, AWS region and bucket (git-ignored; template in `.env.example`) |
| `frontend/vite.config.ts` | Dev server and the `/api` proxy |
| `frontend/tsconfig.json` | Frontend TypeScript: Vue, bundler resolution |
| `frontend/eslint.config.js` | Frontend ESLint (Vue + Cypress globals) |
| `frontend/cypress.config.ts` | Cypress |
