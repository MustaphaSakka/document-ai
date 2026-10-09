# Development

Setup, commands, configuration and conventions for working on this project.

- Layout and layers: [architecture.md](architecture.md)
- Tests: [testing.md](testing.md)
- Frontend rules: [frontend-conventions.md](frontend-conventions.md)

## Prerequisites

- Node.js 18 or later (developed on Node 24)
- npm
- Docker, for the local PostgreSQL container — or any reachable PostgreSQL
- An S3 bucket, for document uploads

## Installation

The backend and the frontend are separate npm projects:

```bash
npm install                  # backend
cd frontend && npm install   # frontend
```

## Configuration

The backend reads its configuration from the environment. Copy the template and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL the API and `npm run migrate` connect to |
| `AWS_REGION` | yes | Region of the S3 client |
| `AWS_S3_BUCKET_NAME` | yes | Bucket the documents are stored in |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | for uploads | Loaded automatically by the SDK; an IAM role works too |

`.env` is git-ignored and must never be committed. `src/db.ts` throws at import time when
`DATABASE_URL` is missing or is not a valid connection URL, and `src/s3-client.ts` does the same
for `AWS_REGION` and `AWS_S3_BUCKET_NAME`. Both failures are deliberate. `src/index.ts` goes one
step further: it opens a connection and runs `SELECT 1` *before* binding the port, so an
unreachable database is reported at startup rather than by whichever request arrives first.

## Database

PostgreSQL holds the document metadata — name, status, S3 location, processing result — while the
file bytes stay in S3. The schema lives in `db/migrations/`, applied by `npm run migrate`; the
container that runs it locally is described in `docker-compose.yml`.

```bash
npm run db:up      # start PostgreSQL and block until it accepts connections
npm run migrate    # apply anything in db/migrations not yet applied
npm run db:down    # stop it; the data stays in the named volume
```

Two databases are created when the container first initialises its volume: `document_ai` for
development, and `document_ai_test` for the test suite (from the script in `db/initdb/`). That
directory is read only when the volume is empty, so a change there means recreating the volume
with `docker compose down -v`.

Migrations are never applied as a side effect of starting the server: a schema change is a
deliberate step, not something a restart does for you. Each `.sql` file runs inside its own
transaction and is recorded in `schema_migrations`, so `npm run migrate` is idempotent.

The suite empties the `documents` table between tests, so `src/db.ts` exports a guard —
`assertTestDatabase()` — that refuses a destructive statement unless the database name ends in
`_test`. A mistyped `DATABASE_URL` therefore fails loudly instead of wiping development data.

## Backend commands

Run from the repository root.

| Command | What it does |
|---|---|
| `npm run db:up` | Start the local PostgreSQL container, waiting until it is ready |
| `npm run db:down` | Stop it; the data stays in the named volume |
| `npm run migrate` | Apply the pending SQL files in `db/migrations/` |
| `npm run dev` | Start the API on <http://localhost:3000> (`tsx`, no build step) |
| `npm run dev:watch` | Same, restarting on file changes |
| `npm run build` | Type-check, then compile to `dist/` |
| `npm start` | Run the compiled server from `dist/` |
| `npm test` | Vitest in watch mode |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src/` |
| `npm run format` | Prettier over `src/**/*.ts` |
| `npm run format:check` | Prettier in check mode |

`npm test` never exits — it is watch mode. Use `npx vitest run` for a single pass, which is
what CI would do. The backend suite talks to PostgreSQL, so `npm run db:up` has to have run
first; it points at `document_ai_test` and applies the migrations itself
([testing.md](testing.md)).

## Frontend commands

Run from `frontend/`.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on <http://localhost:5173>, expects the API on :3000 |
| `npm run build` | `vue-tsc --noEmit`, then a production build |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `vue-tsc` for the app, `tsc` for the config files |
| `npm run lint` | ESLint over `src/` and `cypress/` |
| `npm run format` / `format:check` | Prettier |
| `npm run test:e2e` | Start the dev server, run Cypress headless, stop it |
| `npm run cypress:open` | Cypress interactive runner |
| `npm run cypress:run` | Cypress headless, against an already-running server |

Start the backend first: the frontend has no data of its own.

## TypeScript

`tsconfig.json` targets ES2022 with `module: NodeNext` and compiles `src/` to `dist/`. The
project is ESM (`"type": "module"`), so relative imports carry a `.js` extension even though
the sources are `.ts` — that is what the emitted JavaScript will actually import.

Strict mode is on, along with flags that change how you write code:

| Flag | Effect |
|---|---|
| `noUncheckedIndexedAccess` | `array[i]` and `record[key]` are `T \| undefined`; check before use |
| `noPropertyAccessFromIndexSignature` | `obj.key` is an error on an index signature; use `obj['key']` |
| `noImplicitReturns` | Every code path must return a value |
| `noUnusedLocals` / `noUnusedParameters` | Unused bindings are errors; prefix with `_` when intentional |
| `noImplicitOverride` | `override` is required when overriding a base member |
| `isolatedModules` | Each file must be transpilable on its own; re-export types with `export type` |

`exclude` covers `**/*.test.ts`, so the build never compiles tests — Vitest and your editor
type-check them instead. `rootDir` is `src/`, which is also why `frontend/` and `tests/` do
not interfere with the backend build.

The frontend has its own configuration (`frontend/tsconfig.json`: Vue, `moduleResolution:
bundler`, `verbatimModuleSyntax`). Its rules are in
[frontend-conventions.md](frontend-conventions.md).

## Lint and format

ESLint runs in the flat config format (`eslint.config.js`), with type-aware rules for the
backend:

| Rule | What it enforces |
|---|---|
| `explicit-function-return-type` | Every function declares its return type |
| `no-floating-promises` | A promise is awaited or explicitly marked `void` |
| `no-misused-promises` | No async function where a `void` callback is expected |
| `no-unused-vars` | No unused bindings; a `_` prefix marks a deliberate placeholder |

Type-aware rules need type information, which is why the backend config points at
`tsconfig.json`. On the frontend, `vue-tsc` plays that role for `.vue` files.

Prettier (`/.prettierrc`) is the single source of formatting truth: single quotes, semicolons,
trailing commas, 100 columns, 2 spaces. Do not reformat by hand — `npm run format`.

Note the scope: the backend scripts only cover `src/**/*.ts`. Formatting or linting
`frontend/` requires the frontend scripts, and neither script touches `tests/`.

## Git conventions

Commits use the Conventional Commits types already present in this repository:

| Type | For |
|---|---|
| `feat` | New behaviour |
| `fix` | A bug fix |
| `refactor` | Internal change, same behaviour |
| `docs` | Documentation |
| `test` | Tests |
| `chore` | Tooling, dependencies, configuration |

Messages are short and imperative, with an optional scope: `feat(api): add upload validation`.

There is no CI workflow and no pre-commit hook in this repository, so these checks are
manual. Run them before committing:

```bash
npm run db:up && npm run typecheck && npm run lint && npm run format:check && npx vitest run

cd frontend && npm run typecheck && npm run lint && npm run format:check && npm run test:e2e
```

## Workflow

1. Read the existing code and conventions before writing anything.
2. Decide the types first; they pin down the design.
3. Implement the smallest useful change.
4. Add or update the tests that cover it ([testing.md](testing.md)).
5. Run the checks above.
