import { ref, toValue } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { getDocumentStatus } from '../api/documents';
import type { DocumentStatus } from '../types/document';
import { getErrorMessage } from '../utils/errors';
import { usePolling } from './usePolling';

const PENDING_STATUSES: readonly DocumentStatus[] = ['pending', 'processing'];

interface UseDocumentPolling {
  status: Ref<DocumentStatus | null>;
  isPolling: Ref<boolean>;
  error: Ref<string | null>;
  start: () => void;
  stop: () => void;
}

/**
 * Follows `GET /documents/:id/status` while the document is pending or
 * processing, and stops as soon as the status is terminal.
 *
 * The document id is read on every iteration through `toValue`, so passing a
 * getter keeps the poll pointed at the right document if the caller's id
 * changes — but `stop()` before switching, or the loop will keep running.
 */
export function useDocumentPolling(documentId: MaybeRefOrGetter<string>): UseDocumentPolling {
  const status = ref<DocumentStatus | null>(null);
  const error = ref<string | null>(null);

  function isPending(): boolean {
    const current = status.value;
    return current !== null && PENDING_STATUSES.includes(current);
  }

  const { isPolling, start, stop } = usePolling(
    async () => {
      try {
        const response = await getDocumentStatus(toValue(documentId));
        status.value = response.status;
        error.value = response.error ?? null;
      } catch (caught) {
        error.value = getErrorMessage(caught);
      }
    },
    // A failed request sets `error`, which ends the loop rather than hammering
    // an endpoint that is not answering.
    () => error.value === null && isPending(),
  );

  return { status, isPolling, error, start, stop };
}
