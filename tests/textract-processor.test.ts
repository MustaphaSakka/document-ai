/**
 * Tests for Textract processor functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startTextDetection, pollTextDetection, extractTextFromBlocks } from '../src/textract-processor';

// Mock the Textract client
vi.mock('../src/textract-client', () => ({
  textractClient: {
    send: vi.fn(),
  },
}));

describe('Textract Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startTextDetection', () => {
    it('should start Textract job and return JobId', async () => {
      const { textractClient } = await import('../src/textract-client.js');
      const mockSend = vi.mocked(textractClient.send);

      // Mock successful job start
      mockSend.mockResolvedValueOnce({
        JobId: 'test-job-123',
      });

      const jobId = await startTextDetection('test-bucket', 'test.pdf');

      expect(jobId).toBe('test-job-123');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw error if JobId not returned', async () => {
      const { textractClient } = await import('../src/textract-client.js');
      const mockSend = vi.mocked(textractClient.send);

      // Mock response without JobId
      mockSend.mockResolvedValueOnce({});

      await expect(startTextDetection('test-bucket', 'test.pdf')).rejects.toThrow('Textract did not return a JobId');
    });
  });

  describe('pollTextDetection', () => {
    it('should poll and return SUCCEEDED response', async () => {
      const { textractClient } = await import('../src/textract-client.js');
      const mockSend = vi.mocked(textractClient.send);

      // Mock first call returns IN_PROGRESS, second returns SUCCEEDED
      mockSend.mockResolvedValueOnce({
        JobStatus: 'IN_PROGRESS',
      }).mockResolvedValueOnce({
        JobStatus: 'SUCCEEDED',
        Blocks: [
          { BlockType: 'LINE', Text: 'Hello World' },
          { BlockType: 'LINE', Text: 'Test Document' },
        ],
      });

      const response = await pollTextDetection('test-job-123', 100, 5);

      expect(response.JobStatus).toBe('SUCCEEDED');
      expect(response.Blocks).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should handle FAILED status', async () => {
      const { textractClient } = await import('../src/textract-client.js');
      const mockSend = vi.mocked(textractClient.send);

      mockSend.mockResolvedValueOnce({
        JobStatus: 'FAILED',
        StatusMessage: 'Invalid document format',
      });

      const response = await pollTextDetection('test-job-123', 100, 5);

      expect(response.JobStatus).toBe('FAILED');
      expect(response.StatusMessage).toBe('Invalid document format');
    });

    it('should throw error if job does not complete in time', async () => {
      const { textractClient } = await import('../src/textract-client.js');
      const mockSend = vi.mocked(textractClient.send);

      // Always return IN_PROGRESS
      mockSend.mockResolvedValue({
        JobStatus: 'IN_PROGRESS',
      });

      await expect(pollTextDetection('test-job-123', 100, 3)).rejects.toThrow('did not complete within');
    });
  });

  describe('extractTextFromBlocks', () => {
    it('should extract text from LINE blocks', () => {
      const blocks = [
        { BlockType: 'LINE', Text: 'First line' },
        { BlockType: 'LINE', Text: 'Second line' },
        { BlockType: 'PAGE', Text: '' },
      ];

      const text = extractTextFromBlocks(blocks);

      expect(text).toBe('First line\nSecond line');
    });

    it('should handle empty blocks array', () => {
      const text = extractTextFromBlocks([]);
      expect(text).toBe('');
    });

    it('should handle undefined blocks', () => {
      const text = extractTextFromBlocks(undefined);
      expect(text).toBe('');
    });

    it('should filter out empty text lines', () => {
      const blocks = [
        { BlockType: 'LINE', Text: 'Valid line' },
        { BlockType: 'LINE', Text: '   ' },
        { BlockType: 'LINE', Text: '' },
      ];

      const text = extractTextFromBlocks(blocks);

      expect(text).toBe('Valid line');
    });

    it('should ignore non-LINE blocks', () => {
      const blocks = [
        { BlockType: 'PAGE' },
        { BlockType: 'LINE', Text: 'Keep this' },
        { BlockType: 'TABLE' },
      ];

      const text = extractTextFromBlocks(blocks);

      expect(text).toBe('Keep this');
    });
  });
});
