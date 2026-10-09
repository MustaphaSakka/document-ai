import { ref } from 'vue';
import type { Ref } from 'vue';
import { listDocuments } from '../api/documents';
import type { Document, DocumentStatus } from '../types/document';
import { getErrorMessage } from '../utils/errors';
import { usePolling } from './usePolling';

const UNFINISHED_STATUSES: readonly DocumentStatus[] = ['pending', 'processing'];

interface UseDocuments {
  documents: Ref<Document[]>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  load: () => Promise<void>;
}

/**
 * Owns the document list and the loading/error state around it.
 *
 * While the list holds a document the backend is still processing, it is
 * refreshed in the background, so a status that changes server-side shows up
 * without the user reloading the page.
 *
 * Upload and delete are deliberately left out: they are one-shot actions whose
 * own state belongs to the component triggering them. This composable answers
 * a single question — "what is the current list?".
 */
export function useDocuments(): UseDocuments {
  const documents = ref<Document[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function hasUnfinishedDocuments(): boolean {
    return documents.value.some((document) => UNFINISHED_STATUSES.includes(document.status));
  }

  async function fetchDocuments(): Promise<void> {
    const response = await listDocuments();
    documents.value = response.documents;
  }

  /**
   * Refresh driven by the polling loop. It deliberately does not touch
   * `isLoading`: the table must stay on screen instead of being replaced by the
   * loading state every couple of seconds.
   */
  async function refresh(): Promise<void> {
    try {
      await fetchDocuments();
      error.value = null;
    } catch (caught) {
      error.value = getErrorMessage(caught);
    }
  }

  const { start: startPolling } = usePolling(
    refresh,
    // A failed request sets `error`, which ends the loop; a list with nothing
    // left to process ends it too, so the requests stop on their own.
    () => error.value === null && hasUnfinishedDocuments(),
  );

  /** Explicit load: shows the loading state. Used on mount and after any action. */
  async function load(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await fetchDocuments();
    } catch (caught) {
      documents.value = [];
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

  return { documents, isLoading, error, load };
}
