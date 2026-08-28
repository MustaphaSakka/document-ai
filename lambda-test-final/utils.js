"use strict";
/**
 * Utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createId = createId;
exports.resetIdCounter = resetIdCounter;
/**
 * Generate unique ID
 * Uses a simple counter-based approach for now
 */
let idCounter = 0;
function createId() {
    idCounter++;
    return `doc_${Date.now()}_${idCounter}`;
}
/**
 * Reset ID counter (useful for testing)
 */
function resetIdCounter() {
    idCounter = 0;
}
