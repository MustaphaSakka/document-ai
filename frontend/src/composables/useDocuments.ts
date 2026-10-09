import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { listDocuments } from '../api/documents';
import type { Document, DocumentStatus } from '../types/document';
import { getErrorMessage } from '../utils/errors';
import { usePolling } from './usePolling';

const UNFINISHED_STATUSES: readonly DocumentStatus[] = ['pending', 'processing'];

/**
 * Mirrors the backend defaults (`src/routes/documents.ts`), but is sent
 * explicitly: the screen should show the same page whatever the server would
 * have picked on its own.
 */
export const DEFAULT_PAGE = 1;
export const PAGE_SIZE = 20;

interface UseDocuments {
  documents: Ref<Document[]>;
  currentPage: Ref<number>;
  total: Ref<number>;
  totalPages: Ref<number>;
  /** Page size requested from the API. Fixed for now, so a page is reproducible. */
  limit: Ref<number>;
  search: Ref<string>;
  /** `''` is what the "Tous les statuts" option selects: no filter on status. */
  status: Ref<DocumentStatus | ''>;
  mimeType: Ref<string>;
  hasActiveFilters: ComputedRef<boolean>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  load: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  applyFilters: () => Promise<void>;
  resetFilters: () => Promise<void>;
}

/**
 * Owns the current page of documents, the filters it is taken from, and the
 * loading/error state around them.
 *
 * While the page holds a document the backend is still processing, it is
 * refreshed in the background, so a status that changes server-side shows up
 * without the user reloading the page. The refresh reloads the page on screen,
 * with the filters on screen, never page 1: the background loop follows
 * `currentPage` and reads the filter refs as they are at that moment.
 *
 * Upload and delete are deliberately left out: they are one-shot actions whose
 * own state belongs to the component triggering them. This composable answers
 * a single question — "what does the current page contain?".
 */
export function useDocuments(): UseDocuments {
  const documents = ref<Document[]>([]);
  const currentPage = ref(DEFAULT_PAGE);
  const total = ref(0);
  const totalPages = ref(0);
  const limit = ref(PAGE_SIZE);
  const search = ref('');
  const status = ref<DocumentStatus | ''>('');
  const mimeType = ref('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Whether the list on screen is narrowed. The trimmed comparison is the same
   * one `fetchPage` makes before sending, so a search of spaces is not treated
   * as a filter here while being dropped there.
   */
  const hasActiveFilters = computed<boolean>(
    () => search.value.trim() !== '' || status.value !== '' || mimeType.value.trim() !== '',
  );

  /**
   * Sequence number of the most recent request. A response that is no longer
   * the latest is dropped: without this, a background refresh started before a
   * page change could resolve after it and put the previous page back on
   * screen, under pagination saying otherwise. A filter change races the same
   * way and is covered by the same guard.
   */
  let latestRequestId = 0;

  function hasUnfinishedDocuments(): boolean {
    return documents.value.some((document) => UNFINISHED_STATUSES.includes(document.status));
  }

  async function fetchPage(page: number): Promise<void> {
    const requestId = (latestRequestId += 1);

    // Read at call time, not captured once: the polling loop must refresh with
    // whatever the filters are now, and a filter change must reach the backend
    // on the next request. A blank filter is sent as an absent one.
    const response = await listDocuments({
      page,
      limit: limit.value,
      search: search.value.trim() || undefined,
      status: status.value || undefined,
      mimetype: mimeType.value.trim() || undefined,
    });

    // Superseded while in flight — the newer request owns the state now.
    if (requestId !== latestRequestId) {
      return;
    }

    // A page can fall past the end between two loads: deleting the last
    // document of the last page does exactly that, and so does a filter change
    // — except that a filter change goes back to page 1 on purpose. The backend
    // answers an empty list carrying the real `totalPages` rather than an error,
    // so step back to the last page that exists instead of showing an empty
    // "page 3 / 2".
    if (
      response.documents.length === 0 &&
      response.totalPages >= 1 &&
      response.page > response.totalPages
    ) {
      await fetchPage(response.totalPages);
      return;
    }

    documents.value = response.documents;
    currentPage.value = response.page;
    total.value = response.total;
    totalPages.value = response.totalPages;
  }

  /**
   * Refresh driven by the polling loop. It deliberately does not touch
   * `isLoading`: the table must stay on screen instead of being replaced by the
   * loading state every couple of seconds.
   */
  async function refresh(): Promise<void> {
    try {
      await fetchPage(currentPage.value);
      error.value = null;
    } catch (caught) {
      error.value = getErrorMessage(caught);
    }
  }

  const { start: startPolling } = usePolling(
    refresh,
    // A failed request sets `error`, which ends the loop; a page with nothing
    // left to process ends it too, so the requests stop on their own.
    () => error.value === null && hasUnfinishedDocuments(),
  );

  /** Loads `page` into the view, with the loading and error states around it. */
  async function showPage(page: number): Promise<void> {
    isLoading.value = true;
    error.value = null;

    // Published before the request, not after: the polling loop reads this to
    // decide which page to refresh, and it must not fall back to the page the
    // user just left while the new one is still on its way.
    currentPage.value = page;

    try {
      await fetchPage(page);
    } catch (caught) {
      documents.value = [];
      total.value = 0;
      totalPages.value = 0;
      error.value = getErrorMessage(caught);
    } finally {
      isLoading.value = false;
    }

    // No-op when the loop is already running: it re-reads `shouldContinue` on
    // every iteration, so it stops by itself once nothing is left to process.
    if (error.value === null && hasUnfinishedDocuments()) {
      startPolling();
    }
  }

  /** Explicit load of the page on screen. Used on mount and after any action. */
  async function load(): Promise<void> {
    await showPage(currentPage.value);
  }

  /**
   * Shows another page. Out-of-range targets are ignored rather than clamped:
   * the controls are disabled at both ends, so one arriving here is a caller
   * bug and quietly loading some other page would hide it. With nothing stored,
   * `totalPages` is `0` and every page is refused.
   */
  async function goToPage(page: number): Promise<void> {
    if (!Number.isInteger(page) || page < 1 || page > totalPages.value) {
      return;
    }

    // Already there: reloading would flash the loading state for nothing.
    if (page === currentPage.value) {
      return;
    }

    await showPage(page);
  }

  /**
   * Applies the filters currently set and goes back to the first page.
   *
   * The two always happen together, which is why this is one action rather than
   * two: a page number is an offset into a particular result set, so page 3 of
   * the previous filters means nothing once they change. Reloading the same
   * page instead would leave the user on a page that may not exist any more —
   * or, worse, on a page that does exist but shows results they did not ask
   * for. It goes through `showPage` rather than `goToPage` because page 1 is
   * always a reload here, even when the user is already on it.
   */
  async function applyFilters(): Promise<void> {
    await showPage(DEFAULT_PAGE);
  }

  /** Clears every filter and returns to the unfiltered first page. */
  async function resetFilters(): Promise<void> {
    search.value = '';
    status.value = '';
    mimeType.value = '';

    await applyFilters();
  }

  return {
    documents,
    currentPage,
    total,
    totalPages,
    limit,
    search,
    status,
    mimeType,
    hasActiveFilters,
    isLoading,
    error,
    load,
    goToPage,
    applyFilters,
    resetFilters,
  };
}
