# Frontend Conventions

Conventions for the Vue 3 + TypeScript frontend in [`frontend/`](../frontend/).
They describe how this project is written, with pointers to the code that
already follows them.

The frontend is intentionally small: two views, no global store, no UI
framework. These rules exist to keep it that way as it grows.

## Running the frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, expects the backend on :3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type check (`vue-tsc`) then production build |
| `npm run typecheck` | Type check the app and the config files |
| `npm run lint` | ESLint over `src/` and `cypress/` |
| `npm run format` | Prettier |
| `npm run test:e2e` | Start the dev server, run Cypress headless, stop it |
| `npm run cypress:open` | Cypress interactive runner |

The backend must be running separately (`npm run dev` from the repository root).

## Project layout

```
frontend/
├── cypress/
│   ├── e2e/                 # One spec per user-facing feature
│   ├── fixtures/            # Stubbed API responses
│   └── support/             # Loaded before every spec
└── src/
    ├── api/                 # HTTP calls + typed responses
    ├── components/          # Reusable presentation components
    ├── composables/         # Reactive state and orchestration
    ├── router/              # Routes
    ├── styles/              # Global CSS
    ├── types/               # Shared TypeScript types
    ├── utils/               # Pure helper functions
    └── views/               # One component per route
```

**Views vs components.** A view is bound to a route and owns the page: it calls
composables, orchestrates the async work, and decides what to render. A
component is reusable and knows nothing about routing or where its data came
from. `views/DocumentListView.vue` is a view; `components/DocumentTable.vue`
just receives `documents` and emits `remove`.

## Layering: view → composable → api

```
view  ──uses──▶  composable  ──uses──▶  api  ──fetch──▶  backend
 (renders)        (state)                (HTTP + types)
```

Each layer has one job and never reaches past the one below it.

- **`api/client.ts`** is the only module that calls `fetch`. It turns every
  failure — network or HTTP — into an `ApiError` carrying the status code.
- **`api/documents.ts`** maps one function to one endpoint and nothing else. No
  state, no Vue.
- **`composables/`** hold reactive state (`ref`, `computed`) and the logic that
  keeps it up to date. They never render.
- **`views/` and `components/`** render and handle user interaction.

This is what makes the layers testable and replaceable: swapping `fetch` for
another client only touches `api/client.ts`.

### The `/api` prefix

The frontend calls `/api/documents`; Vite strips the prefix and forwards to
`http://localhost:3000/documents` (see `frontend/vite.config.ts`).

The prefix is not cosmetic. Without it, the API path `/documents` and the SPA
route `/documents` are the same URL, and the proxy answers the page navigation
with JSON instead of `index.html`. Any hard load or refresh of `/documents`
then breaks.

**Rule:** API paths go through the `API_PREFIX` constant in `api/documents.ts`,
never written out as a literal in a component.

Proxying is also why the backend needs no CORS configuration: the browser only
ever talks to its own origin, and CORS is a browser rule, not a server one.

## TypeScript

`frontend/tsconfig.json` uses the same strict baseline as the backend
(`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `verbatimModuleSyntax`).

- **No `any`.** `unknown` plus a narrowing check instead — see
  `isErrorResponse` in `api/client.ts`.
- **Explicit return types** on every function (enforced by ESLint).
- **`import type`** for type-only imports (`verbatimModuleSyntax` makes this an
  error, not a style preference).
- **No type assertions to silence the compiler.** Narrow instead:

  ```ts
  // ❌ hides a real case
  const input = event.target as HTMLInputElement;

  // ✅ the check is the code
  if (!(event.target instanceof HTMLInputElement)) return;
  ```

The one deliberate exception is `src/vue-shims.d.ts`. It exists because the
type-aware ESLint rules run on stock `tsc`, which cannot parse `.vue` files;
`vue-tsc`, which performs the real check, resolves the actual files and never
uses that declaration.

### Typing API responses

Types in `src/types/document.ts` mirror the backend payloads in
`src/routes/documents.ts`.

These interfaces are **compile-time only**: the browser runs JavaScript, so a
response is trusted by contract, not verified at runtime. Two consequences:

- A backend response that changes shape is a *silent* frontend bug. When you
  change a response, change its interface in the same commit.
- Reading a field that may be absent must be explicit. That is why `Document`
  declares `size?: number` and `formatFileSize` accepts `number | undefined`.

## UI states

Every screen that loads data renders four states explicitly. Hiding this behind
a shared abstraction too early costs more than it saves — write them in order
and keep them readable.

```vue
<p v-if="isLoading" class="state">Chargement…</p>

<template v-else-if="error">
  <AppAlert variant="error" :message="error" />
  <button class="button" type="button" @click="load">Réessayer</button>
</template>

<p v-else-if="documents.length === 0" class="state state--muted">
  Aucun document pour le moment.
</p>

<DocumentTable v-else :documents="documents" />
```

Three rules:

1. **`empty` is not `error`.** An empty list is a normal state with its own
   message, not a failure.
2. **`error` always offers a way out** — a retry button, or a back link.
3. **Action states live with the action.** `isUploading` belongs to
   `DocumentUpload.vue`, not to the list composable. A composable that tracks
   every action becomes a store by another name.

## HTTP errors

Error handling is centralised in `api/client.ts`, so callers branch on status
codes instead of parsing bodies.

```ts
export class ApiError extends Error {
  readonly status: number;
}
```

- `getErrorMessage(error: unknown)` (`utils/errors.ts`) turns any thrown value
  into a message safe to display. Use it in every `catch`.
- `catch` gives `unknown`. Narrow it; never assume `Error`.
- Some statuses are **expected states, not failures**. `ExtractedText.vue`
  treats `404` and `409` from `/documents/:id/text` as messages, and only shows
  an error alert for anything else:

  ```ts
  if (caught instanceof ApiError && HANDLED_STATUSES.includes(caught.status)) {
    notice.value = caught.message;
  } else {
    error.value = getErrorMessage(caught);
  }
  ```

- The backend already returns a readable `message`; displaying it beats
  inventing a second vocabulary.

## Async code

- **`async`/`await` over raw `.then()` chains.** Exceptions propagate to the
  `catch` that surrounds the whole operation.
- **One `try`/`catch`/`finally` per user action**, with the state reset at the
  top and the loading flag cleared in `finally`.
- **Never leave a promise unhandled.** In an event handler or lifecycle hook,
  be explicit about it:

  ```ts
  onMounted(() => {
    void load();
  });
  ```

  `@typescript-eslint/no-floating-promises` enforces this.

- **Sequential, not overlapping, polling.** `usePolling` is the single loop
  every polling composable builds on. It uses a `while` loop with `await` rather
  than `setInterval`: each run waits for the previous one, so a slow backend
  cannot pile up concurrent calls. `stop()` resolves the pending sleep so the
  loop can observe `isPolling === false` and return instead of staying suspended
  forever, and `onUnmounted(stop)` guarantees the loop dies with its component.
- **Let the loop decide when it is done.** `usePolling(task, shouldContinue)` has
  no notion of what it is polling for: the caller passes a predicate that is
  re-evaluated after each run on fresh data. `useDocumentPolling` stops once the
  status is terminal; `useDocuments` stops once no document is `pending` or
  `processing` any more. Neither caller has to know when to stop it, which is
  why nothing calls `stop()` by hand.
- **Poll a list in the background, without the loading state.** A refresh driven
  by the loop must not touch `isLoading`, or the table would be replaced by the
  loading placeholder every couple of seconds. `useDocuments` splits the two:
  `load()` shows the loading state (on mount, after an action) while the
  internal `refresh()` updates `documents` silently.
- **A failed poll ends the loop**, rather than retrying an endpoint that is not
  answering. The task records the error, `shouldContinue` returns false, and the
  user gets the usual error state with its retry button.

### Side effects

- Keep side effects in composables and view handlers, not in `computed`.
  A `computed` must be a pure derivation.
- Fetch on `onMounted`, or in a `watch` with `{ immediate: true }` when the
  data depends on a prop.
- Always stop timers, intervals and subscriptions when the component unmounts.

## Vue 3 conventions

- **Composition API with `<script setup lang="ts">`.** No Options API.
- **`defineProps` / `defineEmits` with type-only declarations:**

  ```ts
  const props = defineProps<{ status: DocumentStatus }>();
  const emit = defineEmits<{ remove: [document: Document] }>();
  ```

- **Props down, events up.** A child never mutates what it receives. When it
  needs to change something, it emits and the parent decides.
- **`props.` prefix in templates** when it reads more clearly, and always in
  `<script>`.
- **Type maps must be exhaustive.** `Record<DocumentStatus, string>` in
  `StatusBadge.vue` makes the compiler catch a new status the moment the union
  grows.
- **`computed` for derived values.** Never recompute in the template what a
  `computed` can cache.
- **Route params arrive as props** (`props: true` in `router/index.ts`), so
  views declare `defineProps<{ id: string }>()` instead of reading `$route`.

## Components

- **One component, one responsibility.** If a component fetches data *and*
  renders a form *and* handles deletion, split it.
- **Aim for under ~150 lines** including the template. Past that, look for a
  piece to extract — `DocumentDetailView.vue` delegates the extracted text to
  `ExtractedText.vue` precisely for this reason.
- **Extract on the third repetition.** Two similar blocks are fine; three mean
  the pattern is real. `formatDateTime` and `formatFileSize` live in
  `utils/format.ts` because both the table and the detail page need them.
- **Prefer plain CSS classes over new components.** A `<div class="state">`
  does not need to be a component.
- **No business logic in templates.** If an expression needs a comment, it
  belongs in the script.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Components, views | `PascalCase.vue` | `DocumentTable.vue` |
| Views | `<Feature>View.vue` | `DocumentListView.vue` |
| Composables | `use<Thing>.ts` | `useDocumentPolling.ts` |
| Modules, utils | `camelCase.ts` | `format.ts`, `errors.ts` |
| Types, interfaces | `PascalCase` | `DocumentListResponse` |
| Functions, variables | `camelCase` | `loadDocumentText` |
| Booleans | `is` / `has` / `can` prefix | `isUploading`, `hasText` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_UPLOAD_SIZE_BYTES` |
| CSS classes | BEM-ish blocks | `.table__link`, `.button--danger` |

Names describe intent, not implementation: `load()`, not `fetchAndSetData()`.

## Styling, responsiveness, accessibility

- **Global CSS in `src/styles/main.css`**, organised by block with CSS custom
  properties for colours, radius and spacing. No CSS framework.
- **Mobile first, with a single breakpoint mentality**: use `flex-wrap`,
  `minmax()` and `overflow-x: auto` rather than hard breakpoints. The document
  table scrolls horizontally on narrow screens instead of squeezing columns.
- **Basic accessibility on every change:**

  | Need | Do |
  |---|---|
  | Icon-only or label-less control | `<span class="visually-hidden">` |
  | Table header | `scope="col"` |
  | Status or error message | `role="alert"` / `role="status"` (`AppAlert` does this) |
  | Navigation | a real `<RouterLink>` (focusable, and openable in a new tab) |
  | Form control | a `<label for>` bound to the input id |

  Never put a `@click` on a non-interactive element; use a `button` or a link.

- **Text in French**, in the views and components, since that is what users
  read. Code, comments and identifiers stay in English.

## Cypress

- **One spec per feature** in `cypress/e2e/`, named after the feature:
  `document-upload.cy.ts`.
- **Stub every request with `cy.intercept`.** The suite must pass with the
  backend stopped. Intercepts point at the real URL the app uses, `/api/...`:

  ```ts
  cy.intercept('GET', '/api/documents', { fixture: 'documents.json' }).as('listDocuments');

  cy.visit('/documents');
  cy.wait('@listDocuments');
  ```

  `cy.visit` uses the **SPA route** (`/documents`); `cy.intercept` uses the
  **API path** (`/api/documents`). Mixing them up is the most common mistake in
  this suite.

- **Fixtures for stable payloads** (`cypress/fixtures/*.json`), inline objects
  when a value must change mid-test:

  ```ts
  let callCount = 0;
  cy.intercept('GET', '/api/documents', (request) => {
    callCount += 1;
    request.reply(callCount === 1 ? { statusCode: 500, body: { message: 'Serveur indisponible' } } : { fixture: 'documents.json' });
  });
  ```

- **Test behaviour, not implementation.** Assert on what a user sees — visible
  text, rows, buttons — not on component internals, CSS class names or
  `data-testid` sprinkled for convenience. `cy.contains('td', 'Terminé')`
  survives a refactor; a selector tied to a private class does not.
- **Never assert on locale formatting** (dates, currency). Assert on names,
  statuses and counts. `200.0 Ko` is a deliberate exception: it is produced by
  our own `formatFileSize`.
- **Use `{ timeout }` where a wait is expected**, such as the polling test.
- **Edit `cypress/support/e2e.ts` sparingly.** Add a custom command only when a
  sequence repeats across several specs.

## Dependencies

The bar is: **does this remove more code than it adds?**

In use: `vue`, `vue-router`, `vite`, `typescript`/`vue-tsc`, `cypress`,
`eslint`/`prettier`. Deliberately absent: a state store (no shared state yet),
an HTTP client (`fetch` is built in), a UI framework, a date library
(`Intl` is built in).

Before adding a dependency, ask:

1. Can the platform do it? (`fetch`, `Intl`, `FormData`, `AbortController`)
2. Is it worth its weight *and* its upgrade cost?
3. Does it duplicate something already installed?
4. Is it maintained, and does it ship types?

`frontend` has its own `package.json` and its own `node_modules`; it does not
share dependencies with the backend.

## Review checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run test:e2e` passes with the backend stopped
- [ ] Loading, success, error and empty states are all handled
- [ ] Errors reach the user as a readable message, with a way to retry
- [ ] No `any`, no `as` used to silence the compiler, no floating promises
- [ ] Timers and polling stopped on unmount
- [ ] New interactive elements are reachable by keyboard and labelled
- [ ] Layout still works at 375 px wide
