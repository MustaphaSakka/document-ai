# Documentation

Index of the project documentation. The [root README](../README.md) is the entry point to the
project itself; this directory holds the detail.

## Where to start

| If you want to… | Read |
|---|---|
| understand how the project is built | [architecture.md](architecture.md) |
| run it and know the commands | [development.md](development.md) |
| call the HTTP API | [api.md](api.md) |
| work on the Vue frontend | [frontend-conventions.md](frontend-conventions.md) |
| write or run tests | [testing.md](testing.md) |
| understand Node.js internals | [technical/](technical/) |

---

## [architecture.md](architecture.md)

The two applications and how they connect, the backend and frontend file layouts, the layers
(view → composable → api on the frontend, router → handler → service on the backend), the
document lifecycle from upload to extracted text — S3 for the file bytes, PostgreSQL for the
metadata — and what each configuration file is for.

**Read it when** you are new to the codebase, or before adding a module and wondering where it
belongs.

## [api.md](api.md)

Every endpoint with its parameters, response bodies and status codes — including the
distinctions that matter to a client: `409` while processing is unfinished versus `404` when
there is no text, and the documented limitations (PDF-only extraction, no authentication).

**Read it when** you are calling the API, or changing an endpoint.

## [frontend-conventions.md](frontend-conventions.md)

The conventions the frontend follows: project layout, the `/api` proxy, strict TypeScript and
API response typing, the loading/empty/error state rules, centralized HTTP error handling,
Vue 3 and component conventions, naming, accessibility and responsiveness, the Cypress
practices, and the bar a new dependency has to clear.

**Read it before** adding or changing anything under `frontend/`.

## [development.md](development.md)

Prerequisites, installation, environment variables, running PostgreSQL locally and applying
the migrations, the backend and frontend command references, the TypeScript flags that shape
how you write code, the ESLint and Prettier setup, git commit conventions, and the checks to
run before committing.

**Read it when** you are setting up the project, or you need the exact command for something.

## [testing.md](testing.md)

The two suites — Vitest for the backend, Cypress for the frontend — with their layouts,
configuration, conventions and how to run each one. Includes why the backend suite needs a real
PostgreSQL while AWS is mocked, and why the polling tests are written the way they are.

**Read it when** you are writing tests, or a test fails and you need to know where it lives.

## [technical/](technical/)

Longer-form learning notes on how the underlying technology works, kept separate from the
project documentation above.

- [technical/http-server-concepts.md](technical/http-server-concepts.md) — how Node.js HTTP
  servers work: the event-driven model, `IncomingMessage` and `ServerResponse`, why the server
  is asynchronous, `server.listen()`, graceful shutdown, streaming a response. The code in
  `src/server.ts` is the concrete version of this material.
- [technical/README.md](technical/README.md) — index of that directory.

**Read it when** you want the mechanism behind the code rather than the project's usage of it.

---

## A note on this structure

These documents were consolidated: `commands.md` and `development-workflow.md` became
[development.md](development.md); `project-structure.md` became
[architecture.md](architecture.md); `testing-guide.md` became [testing.md](testing.md);
`typescript-setup.md` and `code-quality.md` were folded into [development.md](development.md);
and `quick-reference.md` was dropped, its accurate commands now living in
[development.md](development.md) and [frontend-conventions.md](frontend-conventions.md).

The previous versions are in the git history (`git log -- docs/`) if you need something that
was removed.
