#!/usr/bin/env node

/**
 * Minimal standalone test script for pdf2json
 * Tests PDF parsing without any application code or S3 dependencies
 */

const path = require('path');
const PDFParser = require('pdf2json');
const fs = require('fs');
const os = require('os');

// Get the PDF file path from command line or use default
const pdfPath = process.argv[2] || './temp/5e5e0301-0f52-4fb9-8350-02a0f40ea444.pdf';
const absolutePath = path.resolve(pdfPath);

console.log('=== PDF2JSON STANDALONE TEST ===');
console.log('Node.js version:', process.version);
console.log('Platform:', os.platform(), os.arch());
console.log('Architecture:', process.arch);
console.log('PDF file:', absolutePath);
console.log('');

// Check if PDF file exists
if (!fs.existsSync(absolutePath)) {
  console.error('❌ ERROR: PDF file not found:', absolutePath);
  process.exit(1);
}

// Read PDF file
let pdfBuffer;
try {
  pdfBuffer = fs.readFileSync(absolutePath);
  console.log('✅ PDF file loaded:', pdfBuffer.length, 'bytes');
} catch (error) {
  console.error('❌ ERROR: Failed to read PDF file:', error.message);
  process.exit(1);
}

// Create PDF parser
let pdfParser;
try {
  pdfParser = new PDFParser();
  console.log('✅ PDFParser instance created');
} catch (error) {
  console.error('❌ ERROR: Failed to create PDFParser:', error.message);
  process.exit(1);
}

// Test PDF parsing
console.log('');
console.log('Testing PDF parsing...');

let parsingComplete = false;
let parsingSuccess = false;
let parsingError = null;
let parsingResult = null;

// Set up event handlers
pdfParser.on('pdfParser_dataReady', (pdfData) => {
  parsingComplete = true;
  parsingSuccess = true;
  parsingResult = pdfData;

  // Extract basic metadata
  const pageCount = pdfData.Pages ? pdfData.Pages.length : 0;
  let textLength = 0;

  if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
    pdfData.Pages.forEach((page) => {
      if (page.Texts && Array.isArray(page.Texts)) {
        page.Texts.forEach((textItem) => {
          if (textItem.R && Array.isArray(textItem.R)) {
            textItem.R.forEach((run) => {
              if (run.T && typeof run.T === 'string') {
                textLength += run.T.length;
              }
            });
          }
        });
      }
    });
  }

  console.log('✅ SUCCESS: PDF parsing completed');
  console.log('   Pages:', pageCount);
  console.log('   Text length:', textLength);
  console.log('   Metadata keys:', pdfData.Meta ? Object.keys(pdfData.Meta).length : 0);

  if (pdfData.Meta) {
    console.log('   Metadata sample:');
    Object.keys(pdfData.Meta).slice(0, 3).forEach(key => {
      console.log('    -', key + ':', typeof pdfData.Meta[key]);
    });
  }
});

pdfParser.on('pdfParser_dataError', (error) => {
  parsingComplete = true;
  parsingSuccess = false;
  parsingError = error;

  console.error('❌ ERROR: PDF parsing failed');
  console.error('   Error:', error.message || error);
  if (error.stack) {
    console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n   '));
  }
});

// Start parsing
try {
  pdfParser.parseBuffer(pdfBuffer);
} catch (error) {
  console.error('❌ ERROR: parseBuffer failed:', error.message);
  process.exit(1);
}

// Wait for parsing to complete (with timeout)
const timeout = 10000; // 10 seconds
const startTime = Date.now();

const waitForCompletion = () => {
  if (parsingComplete) {
    console.log('');
    console.log('=== TEST COMPLETED ===');
    console.log('Result:', parsingSuccess ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Duration:', Date.now() - startTime, 'ms');
    process.exit(parsingSuccess ? 0 : 1);
  } else if (Date.now() - startTime > timeout) {
    console.error('❌ ERROR: Test timed out after', timeout, 'ms');
    process.exit(1);
  } else {
    setTimeout(waitForCompletion, 100);
  }
};

waitForCompletion();
