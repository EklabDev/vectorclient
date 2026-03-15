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

  it('preserves URL verbatim in chunk content or originalReference', async () => {
    const url = 'https://docs.example.com/api';
    const openaiResponse = {
      chunks: [
        { content: `API docs are at ${url}.`, originalReference: `See ${url} for details.`, category: 'API', subcategory: 'Docs' },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const content = `See https://docs.example.com/api for details. This sentence is long enough to trigger OpenAI chunking.`;
    const result = await ChunkingService.chunkContent(content);

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain(url);
    expect(result[0].originalReference).toContain(url);
  });

  it('preserves email and phone in chunk content or originalReference', async () => {
    const openaiResponse = {
      chunks: [
        {
          content: 'Contact support@example.com or +1-555-123-4567.',
          originalReference: 'Support: support@example.com, phone +1-555-123-4567.',
          category: 'Contact',
          subcategory: 'Support',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const content = 'Support: support@example.com, phone +1-555-123-4567. Additional text to exceed the short-content threshold.';
    const result = await ChunkingService.chunkContent(content);

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('support@example.com');
    expect(result[0].content).toContain('+1-555-123-4567');
    expect(result[0].originalReference).toContain('support@example.com');
  });

  it('includes category and subcategory when provided by model', async () => {
    const openaiResponse = {
      chunks: [
        { content: 'Chunk A', originalReference: 'Ref A', category: 'Pricing', subcategory: 'Plans' },
        { content: 'Chunk B', originalReference: 'Ref B', category: 'API', subcategory: 'Auth' },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const content = 'Ref A. Ref B. This is long enough to trigger OpenAI chunking for the response.';
    const result = await ChunkingService.chunkContent(content);

    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('Pricing');
    expect(result[0].subcategory).toBe('Plans');
    expect(result[1].category).toBe('API');
    expect(result[1].subcategory).toBe('Auth');
  });

  it('truncates category and subcategory to 50 characters', async () => {
    const longLabel = 'a'.repeat(60);
    const openaiResponse = {
      chunks: [
        { content: 'C', originalReference: 'R', category: longLabel, subcategory: 'b'.repeat(55) },
      ],
    };

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(openaiResponse) } }],
    });

    const content = 'R. ' + 'x'.repeat(60);
    const result = await ChunkingService.chunkContent(content);

    expect(result).toHaveLength(1);
    expect(result[0].category).toHaveLength(50);
    expect(result[0].category).toBe(longLabel.slice(0, 50));
    expect(result[0].subcategory).toHaveLength(50);
    expect(result[0].subcategory).toBe('b'.repeat(55).slice(0, 50));
  });
});
