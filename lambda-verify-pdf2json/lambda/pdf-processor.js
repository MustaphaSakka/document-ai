"use strict";
/**
 * Lambda Handler for PDF Text Extraction
 * Processes S3 ObjectCreated events and extracts text from PDF documents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
exports.validateS3Event = validateS3Event;
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
const s3_client_js_1 = require("../s3-client.js");
const pdf_text_extractor_js_1 = require("../extractors/pdf-text-extractor.js");
/**
 * Main Lambda handler
 */
async function handler(event) {
    console.log('=== LAMBDA HANDLER START ===', new Date().toISOString());
    console.log('Received S3 event:', JSON.stringify(event, null, 2));
    const processedFiles = [];
    const errors = [];
    let pdfDiagnostic;
    // Process each record (usually only one in practice)
    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        console.log(`Processing file: s3://${bucket}/${key}`);
        try {
            pdfDiagnostic = await processPDFDocument(bucket, key);
            processedFiles.push(key);
            console.log(`Successfully processed: ${key}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to process ${key}: ${errorMessage}`);
            console.error(`Error processing ${key}:`, error);
        }
    }
    return {
        statusCode: errors.length > 0 ? 500 : 200,
        body: JSON.stringify({
            message: errors.length > 0
                ? `Completed with ${errors.length} errors`
                : 'Successfully processed all files',
            processedFiles,
            errors,
        }),
        processedFiles,
        errors,
        pdfDiagnostic,
    };
}
/**
 * Process a single PDF document
 */
async function processPDFDocument(bucket, key) {
    // Extract document ID from key (documents/{uuid}.pdf -> {uuid})
    const documentId = extractDocumentId(key);
    if (!documentId) {
        throw new Error(`Invalid S3 key format: ${key}`);
    }
    // Get PDF from S3
    console.log(`=== BEFORE GETOBJECT === s3://${bucket}/${key}`, new Date().toISOString());
    const s3Response = await s3_client_js_1.s3Client.send(new client_s3_1.GetObjectCommand({
        Bucket: bucket,
        Key: key,
    }));
    console.log(`=== AFTER GETOBJECT === s3://${bucket}/${key}`, new Date().toISOString());
    // Convert stream to buffer
    const chunks = [];
    const stream = s3Response.Body;
    for await (const chunk of stream) {
        if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
        }
        else {
            chunks.push(Buffer.from(chunk));
        }
    }
    const pdfBuffer = Buffer.concat(chunks);
    // PDF buffer diagnostic logging
    const pdfHash = (0, crypto_1.createHash)('sha256').update(pdfBuffer).digest('hex');
    console.log(`=== PDF BUFFER DIAGNOSTIC ===`);
    console.log(`Size: ${pdfBuffer.length} bytes`);
    console.log(`SHA-256: ${pdfHash}`);
    console.log(`=== BEFORE PDF-PARSE === PDF buffer size: ${pdfBuffer.length} bytes`, new Date().toISOString());
    // Extract text from PDF
    const extractionResult = await (0, pdf_text_extractor_js_1.extractPDFText)(pdfBuffer);
    console.log(`=== AFTER PDF-PARSE === Extracted ${extractionResult.numpages} pages`, new Date().toISOString());
    // Store result as JSON in S3
    const resultKey = `documents/${documentId}-extracted.json`;
    const resultBody = JSON.stringify({
        documentId,
        originalKey: key,
        extractedText: extractionResult.text,
        numpages: extractionResult.numpages,
        info: extractionResult.info,
        metadata: extractionResult.metadata,
        extractedAt: extractionResult.extractedAt.toISOString(),
        processingDuration: extractionResult.processingDuration,
    }, null, 2);
    console.log(`=== BEFORE PUTOBJECT === s3://${bucket}/${resultKey}`, new Date().toISOString());
    await s3_client_js_1.s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: resultKey,
        Body: resultBody,
        ContentType: 'application/json',
    }));
    console.log(`=== AFTER PUTOBJECT === s3://${bucket}/${resultKey}`, new Date().toISOString());
    // Return PDF diagnostic information
    return {
        size: pdfBuffer.length,
        sha256: pdfHash,
    };
}
/**
 * Extract document ID from S3 key
 * Supports formats: documents/{uuid}.pdf -> {uuid}
 */
function extractDocumentId(key) {
    const match = key.match(/^documents\/([a-z0-9-]+)\.pdf$/i);
    return match && match[1] ? match[1] : null;
}
/**
 * Validation helper for Lambda events
 */
function validateS3Event(event) {
    if (!event || typeof event !== 'object') {
        return false;
    }
    const s3Event = event;
    return (Array.isArray(s3Event.Records) &&
        s3Event.Records.length > 0 &&
        typeof s3Event.Records[0] === 'object' &&
        s3Event.Records[0] !== null &&
        typeof s3Event.Records[0].s3 === 'object' &&
        s3Event.Records[0].s3 !== null &&
        typeof s3Event.Records[0].s3.bucket === 'object' &&
        s3Event.Records[0].s3.bucket !== null &&
        typeof s3Event.Records[0].s3.bucket.name === 'string' &&
        typeof s3Event.Records[0].s3.object === 'object' &&
        s3Event.Records[0].s3.object !== null &&
        typeof s3Event.Records[0].s3.object.key === 'string');
}
