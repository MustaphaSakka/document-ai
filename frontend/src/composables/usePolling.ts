import { onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';

export const DEFAULT_POLL_INTERVAL_MS = 2000;

interface UsePolling {
  isPolling: Ref<boolean>;
  start: () => void;
  stop: () => void;
}

/**
 * Runs `task` immediately, then every `intervalMs`, until `shouldContinue`
 * returns false.
 *
 * An async loop with `await` is used rather than `setInterval`: each run waits
 * for the previous one to settle, so a slow backend can never accumulate
 * overlapping calls, and `shouldContinue` is re-evaluated on fresh data.
 *
 * `stop()` resolves the pending sleep so the loop observes `isPolling === false`
 * and returns, instead of staying suspended forever. `onUnmounted` ties the
 * loop's life to the component that started it, so a caller never has to
 * remember to clean up.
 *
 * A `task` is expected to record its own errors — that is what lets
 * `shouldContinue` end the loop when a request failed.
 */
export function usePolling(
  task: () => Promise<void>,
  shouldContinue: () => boolean,
  intervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): UsePolling {
  const isPolling = ref(false);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let resumeSleep: (() => void) | null = null;

  function stop(): void {
    isPolling.value = false;

    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    if (resumeSleep !== null) {
      const resume = resumeSleep;
      resumeSleep = null;
      resume();
    }
  }

  function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      resumeSleep = resolve;
      timer = setTimeout(() => {
        timer = null;
        resumeSleep = null;
        resolve();
      }, milliseconds);
    });
  }

  async function run(): Promise<void> {
    isPolling.value = true;

    while (isPolling.value) {
      try {
        await task();
      } catch (caught) {
        // Safety net: a task that lets an error escape would otherwise become
        // an unhandled rejection with no way to surface it.
        console.error('Polling task failed:', caught);
        stop();
        return;
      }

      if (!isPolling.value || !shouldContinue()) {
        stop();
        return;
      }

      await sleep(intervalMs);
    }
  }

  function start(): void {
    if (isPolling.value) {
      return;
    }

    void run();
  }

  onUnmounted(stop);

  return { isPolling, start, stop };
}
