"use strict";
/**
 * PDF Text Extractor
 * Extracts text and metadata from PDF documents using pdf2json
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPDFText = extractPDFText;
exports.hasMeaningfulText = hasMeaningfulText;
exports.getTextStatistics = getTextStatistics;
const pdf2json_1 = __importDefault(require("pdf2json"));
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
        // Extract text and metadata using pdf2json
        const textResult = await extractPDFTextWithPdf2Json(pdfBuffer);
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
 * Extract text from PDF buffer using pdf2json
 * Uses event-based API and handles the complex structure
 */
function extractPDFTextWithPdf2Json(pdfBuffer) {
    return new Promise((resolve, reject) => {
        const pdfParser = new pdf2json_1.default();
        // Handle successful parsing
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            try {
                // Type guard for pdf2json output structure
                if (!pdfData || typeof pdfData !== 'object') {
                    reject(new Error('Invalid PDF data structure'));
                    return;
                }
                const data = pdfData;
                let fullText = '';
                let pageCount = 0;
                // Extract text from all pages
                if (data['Pages'] && Array.isArray(data['Pages'])) {
                    pageCount = data['Pages'].length;
                    data['Pages'].forEach((page) => {
                        if (page && typeof page === 'object') {
                            const pageObj = page;
                            if (pageObj['Texts'] && Array.isArray(pageObj['Texts'])) {
                                pageObj['Texts'].forEach((textItem) => {
                                    if (textItem && typeof textItem === 'object') {
                                        const textObj = textItem;
                                        if (textObj['R'] && Array.isArray(textObj['R'])) {
                                            textObj['R'].forEach((run) => {
                                                if (run && typeof run === 'object') {
                                                    const runObj = run;
                                                    if (runObj['T'] && typeof runObj['T'] === 'string') {
                                                        fullText += runObj['T'];
                                                    }
                                                }
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
                // Extract metadata
                const info = {};
                const metadata = {};
                if (data['Meta'] && typeof data['Meta'] === 'object') {
                    // Copy basic metadata to info
                    const metaObj = data['Meta'];
                    for (const [key, value] of Object.entries(metaObj)) {
                        if (value !== null && value !== undefined) {
                            info[key] = value;
                        }
                    }
                    metadata['raw'] = data['Meta'];
                }
                resolve({
                    text: fullText,
                    numpages: pageCount,
                    info,
                    metadata,
                });
            }
            catch (error) {
                reject(new Error(`Failed to process parsed PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
        // Handle parsing errors
        pdfParser.on('pdfParser_dataError', (err) => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown parsing error';
            reject(new Error(`PDF parsing error: ${errorMessage}`));
        });
        // Start parsing
        try {
            pdfParser.parseBuffer(pdfBuffer);
        }
        catch (error) {
            reject(new Error(`Failed to parse PDF buffer: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    });
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
