const UNKNOWN_VALUE = '—';

/** Formats an ISO date string for display, tolerating an unparsable value. */
export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return UNKNOWN_VALUE;
  }

  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Formats a byte count; the backend omits `size` for some documents. */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) {
    return UNKNOWN_VALUE;
  }

  if (bytes < 1024) {
    return `${bytes} o`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} Ko`;
  }

  return `${(kilobytes / 1024).toFixed(1)} Mo`;
}
