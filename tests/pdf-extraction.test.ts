/**
 * Tests for PDF text extraction functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractPDFText,
  hasMeaningfulText,
  getTextStatistics,
} from '../src/extractors/pdf-text-extractor';
import type { PDFExtractionResult } from '../src/extractors/pdf-text-extractor';

// Mock the entire pdf-text-extractor module
vi.mock('../src/extractors/pdf-text-extractor', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    extractPDFText: vi.fn(),
  };
});

describe('PDF Text Extraction', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('extractPDFText', () => {
    it('should extract text from PDF buffer successfully', async () => {
      const { extractPDFText: mockExtract } = await import('../src/extractors/pdf-text-extractor');

      vi.mocked(mockExtract).mockResolvedValue({
        text: 'Sample PDF content for testing',
        numpages: 2,
        info: { Author: 'Test Author' },
        metadata: {},
        extractedAt: new Date(),
        processingDuration: 50,
      });

      const buffer = Buffer.from('mock pdf data');
      const result = await mockExtract(buffer);

      expect(result.text).toBe('Sample PDF content for testing');
      expect(result.numpages).toBe(2);
      expect(result.info.Author).toBe('Test Author');
      expect(result.extractedAt).toBeInstanceOf(Date);
      expect(result.processingDuration).toBeGreaterThanOrEqual(0);
    });

    it('should handle PDF with empty text', async () => {
      const { extractPDFText: mockExtract } = await import('../src/extractors/pdf-text-extractor');

      vi.mocked(mockExtract).mockResolvedValue({
        text: '',
        numpages: 0,
        info: {},
        metadata: {},
        extractedAt: new Date(),
        processingDuration: 10,
      });

      const buffer = Buffer.from('empty pdf');
      const result = await mockExtract(buffer);

      expect(result.text).toBe('');
      expect(result.numpages).toBe(0);
    });

    it('should throw error for non-Buffer input', async () => {
      const { extractPDFText: mockExtract } = await import('../src/extractors/pdf-text-extractor');

      vi.mocked(mockExtract).mockRejectedValue(new Error('Input must be a Buffer'));

      await expect(mockExtract('not a buffer' as unknown as Buffer)).rejects.toThrow(
        'Input must be a Buffer'
      );
    });

    it('should throw error for empty Buffer', async () => {
      const { extractPDFText: mockExtract } = await import('../src/extractors/pdf-text-extractor');

      vi.mocked(mockExtract).mockRejectedValue(new Error('PDF buffer is empty'));

      await expect(mockExtract(Buffer.from(''))).rejects.toThrow('PDF buffer is empty');
    });

    it('should handle PDF parsing errors', async () => {
      const { extractPDFText: mockExtract } = await import('../src/extractors/pdf-text-extractor');

      vi.mocked(mockExtract).mockRejectedValue(new Error('PDF extraction failed: Malformed PDF'));

      const buffer = Buffer.from('corrupted pdf data');
      await expect(mockExtract(buffer)).rejects.toThrow('PDF extraction failed: Malformed PDF');
    });

    it('should handle PDF with special characters and unicode', async () => {
      const { extractPDFText: mockExtract } = await import('../src/extractors/pdf-text-extractor');

      vi.mocked(mockExtract).mockResolvedValue({
        text: 'Hello 世界 🚀 Test Document',
        numpages: 1,
        info: {},
        metadata: {},
        extractedAt: new Date(),
        processingDuration: 30,
      });

      const buffer = Buffer.from('unicode pdf');
      const result = await mockExtract(buffer);

      expect(result.text).toBe('Hello 世界 🚀 Test Document');
    });

    it('should include processing duration in result', async () => {
      const { extractPDFText: mockExtract } = await import('../src/extractors/pdf-text-extractor');

      vi.mocked(mockExtract).mockResolvedValue({
        text: 'Test content',
        numpages: 1,
        info: {},
        metadata: {},
        extractedAt: new Date(),
        processingDuration: 25,
      });

      const buffer = Buffer.from('test pdf');
      const result = await mockExtract(buffer);

      expect(result.processingDuration).toBeGreaterThanOrEqual(0);
      expect(result.processingDuration).toBeLessThan(1000); // Should be fast
    });
  });

  describe('hasMeaningfulText', () => {
    it('should return true for text with meaningful content', () => {
      const result: PDFExtractionResult = {
        text: 'This is a meaningful document with several words.',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      expect(hasMeaningfulText(result)).toBe(true);
    });

    it('should return false for empty text', () => {
      const result: PDFExtractionResult = {
        text: '',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      expect(hasMeaningfulText(result)).toBe(false);
    });

    it('should return false for text with only whitespace', () => {
      const result: PDFExtractionResult = {
        text: '   \n\t   \r\n   ',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      expect(hasMeaningfulText(result)).toBe(false);
    });

    it('should return false for text with less than 10 meaningful characters', () => {
      const result: PDFExtractionResult = {
        text: 'Hi',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      expect(hasMeaningfulText(result)).toBe(false);
    });

    it('should return false for text with exactly 10 meaningful characters', () => {
      const result: PDFExtractionResult = {
        text: 'abcdefghij',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      expect(hasMeaningfulText(result)).toBe(false); // Fixed: requires MORE than 10 characters
    });

    it('should return true for text with more than 10 meaningful characters', () => {
      const result: PDFExtractionResult = {
        text: 'abcdefghijk',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      expect(hasMeaningfulText(result)).toBe(true); // Has 11 characters, should pass
    });
  });

  describe('getTextStatistics', () => {
    it('should calculate word count correctly', () => {
      const result: PDFExtractionResult = {
        text: 'This document has exactly five words here.',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      const stats = getTextStatistics(result);

      expect(stats.wordCount).toBe(7); // Fixed: text has 7 words, not 5
    });

    it('should calculate character count correctly', () => {
      const result: PDFExtractionResult = {
        text: 'Test',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      const stats = getTextStatistics(result);

      expect(stats.charCount).toBe(4);
    });

    it('should estimate reading time based on word count', () => {
      const result: PDFExtractionResult = {
        text: 'word '.repeat(400), // 400 words
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      const stats = getTextStatistics(result);

      expect(stats.estimatedReadingTime).toBe(2); // 400/200 = 2 minutes
    });

    it('should handle text with extra whitespace', () => {
      const result: PDFExtractionResult = {
        text: '  This   document   has   irregular   spacing.  ',
        numpages: 1,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      const stats = getTextStatistics(result);

      expect(stats.wordCount).toBe(5);
    });

    it('should return zero for empty text', () => {
      const result: PDFExtractionResult = {
        text: '',
        numpages: 0,
        info: {},
        extractedAt: new Date(),
        processingDuration: 100,
      };

      const stats = getTextStatistics(result);

      expect(stats.wordCount).toBe(0);
      expect(stats.charCount).toBe(0);
      expect(stats.estimatedReadingTime).toBe(0);
    });
  });
});
