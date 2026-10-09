# API Reference

HTTP API exposed by the document service (`src/server.ts`, handlers in `src/routes/documents.ts`).

- **Base URL**: `http://localhost:3000` (port set in `src/index.ts`)
- **Format**: all responses are JSON, with `Content-Type: application/json`
- **Authentication**: none
- **Storage**: metadata in PostgreSQL, file bytes in Amazon S3

## Conventions

### Document status

| Status | Meaning |
|---|---|
| `pending` | Created, processing not started yet |
| `processing` | Text extraction in progress |
| `completed` | Processing finished; `processingResult` is available |
| `failed` | Processing failed; `error` holds the reason |

### Document object

Returned by `GET /documents` and `GET /documents/:id`:

```json
{
  "id": "doc_1770000000000_1",
  "name": "report.pdf",
  "status": "completed",
  "createdAt": "2026-02-01T10:00:00.000Z",
  "size": 2048,
  "mimetype": "application/pdf",
  "processingResult": {
    "wordCount": 412,
    "pageEstimated": 2,
    "processingDuration": 87,
    "processedAt": "2026-02-01T10:00:01.000Z"
  },
  "error": "Optional, only when status is failed"
}
```

`size`, `mimetype`, `processingResult` and `error` are omitted when unknown. `processingResult` is only
present once processing completed. The extracted text itself is **not** part of this object: use
`GET /documents/:id/text`.

### Error object

```json
{ "error": "Not Found", "message": "Document doc_123 not found" }
```

`message` is present for document-level errors, absent on the generic 404 for unknown routes.

---

## `POST /documents`

Upload a file, create a document and start text extraction in the background.

- **Request body**: `multipart/form-data` with one file part. The field name is not validated; `file` is
  the convention.
- **Constraints**: max 5 MB, and one of these content types:
  `application/pdf`, `application/msword`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/jpeg`,
  `image/png`, `text/plain`.

```bash
curl -i -F "file=@report.pdf;type=application/pdf" http://localhost:3000/documents
```

**201 Created** — plus a `Location: /documents/{id}` header:

```json
{
  "id": "doc_1770000000000_1",
  "name": "report.pdf",
  "status": "pending",
  "createdAt": "2026-02-01T10:00:00.000Z",
  "size": 2048,
  "mimetype": "application/pdf"
}
```

Processing is not awaited: the response usually reports `pending`, but a fast document may already be
`processing` by the time the client reads it. Poll `GET /documents/:id/status`.

| Code | Reason |
|---|---|
| 201 | Document created (`Location` header set) |
| 400 | No file in the request, upload failed, or file type not allowed |
| 413 | File over the 5 MB limit; nothing is stored in S3 |
| 415 | `Content-Type` is not `multipart/form-data` |
| 500 | Unexpected server error |

## `GET /documents`

List documents, most recent first, one page at a time.

- **Parameters** (both optional):
  - `page` — which page to return, 1-based. Default `1`.
  - `limit` — how many documents per page. Default `20`, maximum `100`.
- **Order**: `created_at` descending, then `id` descending. The second key is the tie-break that keeps
  paging stable when two documents share a timestamp.
- **Validation**: a parameter must be a plain run of digits. `page=0`, `limit=0`, `1.5`, `abc`, an
  empty value, `1e2`, or the same parameter given twice are all `400` — never read as something else,
  and never silently ignored. There is no filtering and no search.

**200 OK** — `GET /documents?page=1&limit=20`:

```json
{
  "documents": [
    {
      "id": "doc_1770000000000_1",
      "name": "report.pdf",
      "status": "completed",
      "createdAt": "2026-02-01T10:00:00.000Z",
      "size": 2048,
      "mimetype": "application/pdf"
    }
  ],
  "total": 125,
  "page": 1,
  "limit": 20,
  "totalPages": 7
}
```

Documents are [Document objects](#document-object). `total` counts every stored document, not the ones
on this page, so it is the same on every page. `totalPages` is `ceil(total / limit)`, and `0` when
nothing is stored at all.

| Code | Reason |
|---|---|
| 200 | Always — including an empty list, and a page past the last one |
| 400 | `page` or `limit` is not an integer >= 1, is given twice, or `limit` is over 100 |

A page past the last one is not an error: it returns `documents: []` with the real `total`, which is
how a client discovers it has gone too far.

## `GET /documents/:id`

Retrieve a single document.

- **Parameters**: `id` — the document identifier.

**200 OK**: a [Document object](#document-object), without the extracted text.

| Code | Reason |
|---|---|
| 200 | Document found |
| 404 | Unknown document ID |
| 400 | Empty ID (request to `/documents/`) |

## `GET /documents/:id/status`

Lightweight status check, meant for polling while a document is being processed.

- **Parameters**: `id` — the document identifier.

**200 OK**:

```json
{
  "id": "doc_1770000000000_1",
  "status": "processing",
  "createdAt": "2026-02-01T10:00:00.000Z"
}
```

`error` is included only when `status` is `failed`. The processing result and metrics are not part of
this response.

| Code | Reason |
|---|---|
| 200 | Document found |
| 404 | Unknown document ID |
| 400 | Empty ID |

## `GET /documents/:id/text`

Retrieve the extracted text. This is the only endpoint exposing the text.

- **Parameters**: `id` — the document identifier.

**200 OK**:

```json
{
  "id": "doc_1770000000000_1",
  "text": "Invoice number 12345 ...",
  "numpages": 2,
  "extractedAt": "2026-02-01T10:00:01.000Z"
}
```

`text` can be an empty string when the document was processed but contains no text layer (for example
a scanned PDF). That is a valid success response, distinct from a `404`.

| Code | Reason |
|---|---|
| 200 | Text available (possibly empty) |
| 404 | Unknown document ID, or processing completed with no extracted text (non-PDF types) |
| 409 | Processing is still `pending`/`processing`, or it ended in `failed` |
| 400 | Empty ID |

## `DELETE /documents/:id`

Delete a document.

- **Parameters**: `id` — the document identifier.
- **Side effects**: deletes the stored S3 object, then the `documents/{uuid}-extracted.json` object when
  the source is a PDF, then the PostgreSQL row. The S3 calls come first on purpose: if either fails the
  document stays visible and the request can be retried.

**204 No Content** — empty body.

| Code | Reason |
|---|---|
| 204 | Document deleted |
| 404 | Unknown document ID (including a second delete of the same document) |
| 500 | S3 deletion failed; the document was kept and can be retried |
| 400 | Empty ID |

## `GET /health`

Liveness check.

**200 OK**:

```json
{ "status": "ok" }
```

---

## Known Limitations

1. **Text extraction is PDF-only.** Other accepted types (Word, JPEG, PNG) are counted but have no
   extracted text, so `GET /documents/:id/text` returns `404` for them.
2. **Status reflects this API only.** The extraction Lambda writes its own
   `documents/{uuid}-extracted.json` to S3 and the API does not read it back, so processing done there
   is not visible through these endpoints.
3. **None of these exist yet**: authentication, search, document update, processing
   history across attempts.
