import { ApiError } from '../api/client';

const UNEXPECTED_ERROR_MESSAGE = 'Une erreur inattendue est survenue.';

/**
 * Turns any thrown value into a message safe to display.
 *
 * `catch` gives `unknown`: the thrown value can be anything, so it has to be
 * narrowed before use.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return UNEXPECTED_ERROR_MESSAGE;
}
