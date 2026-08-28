"use strict";
/**
 * PDF Text Extractor
 * Extracts text and metadata from PDF documents using pdf-parse
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPDFText = extractPDFText;
exports.hasMeaningfulText = hasMeaningfulText;
exports.getTextStatistics = getTextStatistics;
// Import pdf-parse function (default import)
const pdf_parse_1 = __importDefault(require("pdf-parse"));
/**
 * Extract text and metadata from a PDF buffer
 */
async function extractPDFText(pdfBuffer) {
    const startTime = Date.now();
    try {
        // Validate input
        if (!Buffer.isBuffer(pdfBuffer)) {
            throw new Error('Input must be a Buffer');
        }
        if (pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty');
        }
        // Extract text and metadata using pdf-parse
        const textResult = await (0, pdf_parse_1.default)(pdfBuffer);
        const processingDuration = Date.now() - startTime;
        return {
            text: textResult.text || '',
            numpages: textResult.numpages || 0,
            info: textResult.info || {},
            metadata: textResult.metadata || {},
            extractedAt: new Date(),
            processingDuration,
        };
    }
    catch (error) {
        if (error instanceof Error) {
            // Re-throw with more context while preserving the original error
            throw new Error(`PDF extraction failed: ${error.message}`, { cause: error });
        }
        // Unknown error type - preserve what we can
        throw new Error('PDF extraction failed: Unknown error', { cause: error });
    }
}
/**
 * Validate if extracted text has meaningful content
 */
function hasMeaningfulText(extractionResult) {
    // Check if we have any text content
    if (!extractionResult.text || extractionResult.text.trim().length === 0) {
        return false;
    }
    // Check if text is not just whitespace or special characters
    const meaningfulChars = extractionResult.text.replace(/\s+/g, '').length;
    return meaningfulChars > 10; // At least 10 meaningful characters
}
/**
 * Get basic statistics from extracted text
 */
function getTextStatistics(extractionResult) {
    const words = extractionResult.text.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const charCount = extractionResult.text.length;
    const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute
    return {
        wordCount,
        charCount,
        estimatedReadingTime,
    };
}
