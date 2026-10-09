# Document AI

A document management and processing platform built with Node.js and TypeScript, with a Vue 3
frontend. File bytes are stored in Amazon S3 and the document metadata in PostgreSQL; text is
extracted in the background and served over a small HTTP API.

## What the application is for

The project covers the life of a document, from the moment it is deposited to the moment its
content can be used:

```
User
  │
  ▼
Upload a document
  │
  ▼
Storage — the bytes in S3, the metadata in PostgreSQL
  │
  ▼
Processing status — pending → processing → completed / failed
  │
  ▼
Text extraction — the content of the document
  │
  ▼
Consultation — the list, the detail, the extracted text
  │
  ▼
Later — analysis and enrichment by AI
```

The value is in centralising documents, following their processing, extracting their content and
preparing that content for automated exploitation, instead of leaving files in mailboxes and
shared folders.

That makes the platform a possible base for invoices, contracts, receipts or administrative
documents. Those are use cases it can support, not features it specialises in today: it accepts,
stores, tracks and extracts text from any document of the types listed below.

## MVP approach

The project is developed as an MVP, one step at a time: each step adds a capability that can
actually be used, while the technical base stays simple and evolvable. The goal is to validate
functional needs and technical choices progressively, before introducing more complexity.

The target architecture is deliberately not built up front. There is no job queue, no event bus
and no AI pipeline yet, because nothing yet needs them. Working this way:

- validates each capability on a running application rather than on a design;
- keeps premature complexity out of the codebase;
- leaves every step testable, with the Vitest and Cypress suites covering what exists;
- lets the architecture grow with the needs instead of ahead of them;
- defers the AWS and AI components until a real need for them appears.

### Available today

- **Upload** — PDF, Word, JPEG, PNG or plain text, max 5 MB, streamed to Amazon S3
- **Storage** — the file bytes in S3 and the metadata in PostgreSQL, so a document and its status
  survive a restart of the API
- **Status tracking** — `pending` → `processing` → `completed` / `failed`
- **Text extraction** — PDF text in the background, with word count and page estimate
- **Consultation** — the document list, a document's detail, and the extracted text over its own
  endpoint (`409` while processing is unfinished, `404` for types that have no text layer)
- **Search and filters** — the list narrows by document name, status or MIME type, and pages over
  the filtered result
- **Deletion** — removes the S3 objects first, then the PostgreSQL row
- **HTTP API** — endpoints for all of the above, with the list returned one page at a time,
  optionally filtered
- **Web interface** — Vue 3: list, upload, detail, extracted text and delete, with live status
  updates that need no page reload

### Roadmap

Directions under consideration, not features that exist. Anything here may change, and none of it
is implemented today:

- asynchronous processing of documents
- deeper integration of the AWS services
- authentication and user management
- analysis and enrichment of documents by AI
- semantic search / RAG

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

## Stack

| Layer | Technology |
|---|---|
| Language and runtime | Node.js, TypeScript (strict, ESM) |
| HTTP | Node's built-in `http` module — no framework |
| Storage | Amazon S3 for the file bytes, PostgreSQL for the metadata |
| Uploads and PDF parsing | `busboy`, `pdf2json` |
| Frontend | Vue 3 + Vite + TypeScript |
| Tests | Vitest (backend), Cypress (frontend, end-to-end) |
| Local infrastructure | Docker Compose, for PostgreSQL |

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
npx vitest run                          # backend: 11 files, 174 tests
cd frontend && npm run test:e2e         # frontend: 7 Cypress specs, 36 tests
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
