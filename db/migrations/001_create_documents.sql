-- Documents and their processing state.
--
-- Replaces the in-memory Map that used to hold these records: the row now
-- outlives the process, while the file bytes stay in S3 (s3_bucket / s3_key).

CREATE TABLE documents (
  -- Format produced by createId(): doc_<milliseconds>_<counter>. Kept as TEXT
  -- so identifiers already handed out by the API do not change.
  id                TEXT        PRIMARY KEY,
  name              TEXT        NOT NULL,

  -- TEXT + CHECK rather than an ENUM type: adding a status later is an ALTER of
  -- this constraint, not an ALTER TYPE with its own set of migration rules.
  status            TEXT        NOT NULL
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Where the file lives in S3; NULL until the upload has been stored.
  s3_bucket         TEXT,
  s3_key            TEXT,

  -- INTEGER, not BIGINT: node-postgres returns BIGINT as a string, to avoid
  -- losing precision past 2^53, which would break `size: number` in the JSON
  -- response. Uploads are capped at 5 MB, so INTEGER is far more than enough.
  size              INTEGER,
  mimetype          TEXT,

  -- Last error message. Only written when a transition to 'failed' carries one,
  -- which is why updates use COALESCE rather than assigning NULL.
  error             TEXT,

  -- ProcessingResult stored whole: wordCount, pageEstimated,
  -- processingDuration, processedAt and the extracted text. JSONB because the
  -- API returns this object as it is; moving the extracted text into a table of
  -- its own would be a later step.
  processing_result JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The list endpoint returns newest first. Ids increase within a run, so the
-- second column keeps the order stable when two rows share a timestamp.
CREATE INDEX documents_created_at_idx ON documents (created_at DESC, id DESC);
