# Document AI

A document processing application built with Node.js and TypeScript, with a Vue 3 frontend.
File bytes are stored in Amazon S3 and the document metadata in PostgreSQL; text is extracted
in the background and served over a small HTTP API.

## Features

- **Upload** a document (PDF, Word, JPEG, PNG or plain text, max 5 MB), streamed to Amazon S3
- **Text extraction** for PDFs, with word count and page estimate
- **Durable metadata** in PostgreSQL: documents and their status survive a restart of the API
- **Document list** with name, status, date and size
- **Status tracking**: `pending` → `processing` → `completed` / `failed`
- **Extracted text** endpoint, distinct from the 409 returned while processing is unfinished
- **Deletion**, which removes the S3 objects and then the PostgreSQL row
- **Web interface** covering all of it: list, upload, detail, extracted text, delete, and live
  status updates that need no page reload

## Architecture at a glance

```
Browser — Vue 3 + Vite (:5173)
   │   /api/* proxied by Vite to http://localhost:3000
   ▼
HTTP server — src/server.ts
   │   route table: method + path segments
   ▼
src/routes/documents.ts — HTTP concerns
   │
   ├──► DocumentService ──► DocumentRepository ──► PostgreSQL — records and status
   └──► S3 — the file bytes ──► src/processor.ts — background extraction (pdf2json)

The client polls GET /documents/:id/status until processing finishes.
```

Details, layers and file layout: [docs/architecture.md](docs/architecture.md).

## Quick start

Two processes and a database. The backend needs a reachable PostgreSQL, and it refuses to start
without `AWS_REGION` and `AWS_S3_BUCKET_NAME`.

```bash
# Terminal 1 — database, then the API on http://localhost:3000
npm install
cp .env.example .env     # then set AWS_REGION and AWS_S3_BUCKET_NAME
                         # (if .env already exists, just edit it)
npm run db:up            # PostgreSQL in Docker; returns once it accepts connections
npm run migrate          # create the documents table
npm run dev

# Terminal 2 — interface on http://localhost:5173
cd frontend
npm install
npm run dev
```

Then open <http://localhost:5173/documents>.

Uploading also needs AWS credentials (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, or an IAM
role). Everything else works without them.

## Tests

```bash
npm run db:up                           # the backend suite needs PostgreSQL
npx vitest run                          # backend: 11 files, 130 tests
cd frontend && npm run test:e2e         # frontend: 5 Cypress specs, 18 tests
```

The backend suite runs against the `document_ai_test` database, which `npm run db:up` creates
alongside the development one. It applies the migrations itself and empties the table between
tests, so starting the container is the only preparation it needs.

## Documentation

| Document | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Index of all documentation |
| [docs/architecture.md](docs/architecture.md) | Layout, layers, request lifecycle |
| [docs/api.md](docs/api.md) | Endpoints, status codes, known limitations |
| [docs/frontend-conventions.md](docs/frontend-conventions.md) | Vue 3, TypeScript and Cypress conventions |
| [docs/development.md](docs/development.md) | Setup, commands, configuration, git |
| [docs/testing.md](docs/testing.md) | The Vitest and Cypress suites |
| [docs/technical/](docs/technical/) | Learning notes on Node.js internals |

## A note on the goal

This is a learning project: the objective is depth in Node.js and TypeScript, so quality,
type safety and explicitness come before delivery speed. The working principles are in
[CLAUDE.md](CLAUDE.md).

## License

ISC
