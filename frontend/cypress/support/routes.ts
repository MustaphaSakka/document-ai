/**
 * Route patterns shared by the specs.
 *
 * `cy.intercept` matches a string against the whole URL, query string
 * included, so a bare `'/api/documents'` stops matching the list endpoint as
 * soon as the app asks for a page (`?page=1&limit=20`) — which it now always
 * does. This pattern matches the list endpoint with or without a query, and
 * leaves the detail routes alone: those continue with a `/` of their own.
 */

/** `/api/documents` and `/api/documents?page=1&limit=20`. */
export const DOCUMENTS_LIST_URL = /\/api\/documents(\?|$)/;
