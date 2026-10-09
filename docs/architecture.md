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
├── index.ts                      entry point: loads .env, starts the server on port 3000
├── server.ts                     HTTP server, route table, dispatch to handlers
├── routes/
│   └── documents.ts              one handler per endpoint
├── document-service.ts           in-memory Map of documents, status transitions
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
   ├──► document-service.ts    in-memory state; knows nothing about HTTP or S3
   └──► s3-file-handler.ts     S3 concerns; knows nothing about HTTP
```

Handlers translate between HTTP and those two collaborators. Business state lives in
`DocumentService`; infrastructure is behind `s3-client.ts` and `s3-file-handler.ts`; and
`server.ts` knows nothing about documents.

Routes are matched on the HTTP method **and the exact number of path segments**
(`src/server.ts`). That is what keeps `/documents/:id` from swallowing
`/documents/:id/status`.

### Document lifecycle

```
POST /documents
  → validate content type, size (5 MB), mime type
  → stream the file to S3
  → create the record with status "pending"
  → 201 Created; processing continues in the background
       → "processing"
       → pdf2json extracts the text
       → "completed", or "failed" with an error message
```

The upload response does not wait for processing: it usually reports `pending`, and a fast
document may already be `processing` by the time the client reads it. The client follows
progress with `GET /documents/:id/status` — see
[api.md](api.md#get-documentsidstatus).

Records are held in memory only. Restarting the server loses them while the S3 objects
remain; see [Known Limitations](api.md#known-limitations).

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
| `vitest.config.ts` | Test environment variables, `tests/setup.ts` |
| `.env` | AWS region and bucket (git-ignored; template in `.env.example`) |
| `frontend/vite.config.ts` | Dev server and the `/api` proxy |
| `frontend/tsconfig.json` | Frontend TypeScript: Vue, bundler resolution |
| `frontend/eslint.config.js` | Frontend ESLint (Vue + Cypress globals) |
| `frontend/cypress.config.ts` | Cypress |
