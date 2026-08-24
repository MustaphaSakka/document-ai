/**
 * Utility functions
 */

/**
 * Generate unique ID
 * Uses a simple counter-based approach for now
 */
let idCounter = 0;

export function createId(): string {
  idCounter++;
  return `doc_${Date.now()}_${idCounter}`;
}

/**
 * Reset ID counter (useful for testing)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}
