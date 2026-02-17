import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkingService, Chunk } from './chunkingService';

// Mock OpenAI
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
    __mockCreate: mockCreate,
  };
});

// Get reference to the mock so we can control it per test
async function getMockCreate() {
  const mod = await import('openai') as any;
  return mod.__mockCreate as ReturnType<typeof vi.fn>;
}

describe('ChunkingService', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it('returns empty array for empty content', async () => {
    const result = await ChunkingService.chunkContent('');
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only content', async () => {
    const result = await ChunkingService.chunkContent('   ');
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns single chunk for very short content', async () => {
    const result = await ChunkingService.chunkContent('Short text.');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      content: 'Short text.',
      originalReference: 'Short text.',
      chunkIndex: 0,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('calls OpenAI and returns chunks for longer content', async () => {
    const openaiResponse = [
      { content: 'Fact 1 about the API.', originalReference: 'The API supports fact 1.' },
      { content: 'Fact 2 about authentication.', originalReference: 'Authentication uses JWT tokens.' },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const longContent = 'The API supports fact 1. Authentication uses JWT tokens. Rate limiting is 100 req/min.';
    const result = await ChunkingService.chunkContent(longContent);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      content: 'Fact 1 about the API.',
      originalReference: 'The API supports fact 1.',
      chunkIndex: 0,
    });
    expect(result[1]).toEqual({
      content: 'Fact 2 about authentication.',
      originalReference: 'Authentication uses JWT tokens.',
      chunkIndex: 1,
    });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('handles { chunks: [...] } response format', async () => {
    const openaiResponse = {
      chunks: [
        { content: 'Chunk A', originalReference: 'Source A sentence.' },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const content = 'Source A sentence. This has enough text to exceed the fifty character minimum threshold.';
    const result = await ChunkingService.chunkContent(content);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Chunk A');
    expect(result[0].originalReference).toBe('Source A sentence.');
  });

  it('falls back to single chunk if OpenAI returns empty array', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '[]' } }],
    });

    const content = 'This is some content that is long enough to trigger the OpenAI call path for processing.';
    const result = await ChunkingService.chunkContent(content);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(content);
    expect(result[0].chunkIndex).toBe(0);
  });

  it('throws on OpenAI empty response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    const content = 'This is some content that is long enough to trigger the OpenAI call path for processing.';
    await expect(ChunkingService.chunkContent(content)).rejects.toThrow('OpenAI returned empty response during chunking');
  });

  it('assigns sequential chunkIndex values', async () => {
    const openaiResponse = [
      { content: 'C1', originalReference: 'R1' },
      { content: 'C2', originalReference: 'R2' },
      { content: 'C3', originalReference: 'R3' },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const content = 'R1. R2. R3. This is additional text to meet the minimum length for OpenAI chunking call.';
    const result = await ChunkingService.chunkContent(content);

    expect(result.map(c => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it('uses content as originalReference when originalReference is missing', async () => {
    const openaiResponse = [
      { content: 'Some fact', originalReference: '' },
    ];

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const content = 'Some longer content that exceeds the minimum character threshold for OpenAI processing.';
    const result = await ChunkingService.chunkContent(content);

    expect(result[0].originalReference).toBe('Some fact');
  });
});
