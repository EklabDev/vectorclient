import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: (...args: unknown[]) => createMock(...args),
      },
    };
  },
}));

vi.mock('./tools/weaviateTool', () => ({
  searchKnowledgeTool: {
    name: 'search_knowledge',
    description: 'search',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: vi.fn(async () => ({ results: [{ content: 'Saturday 10am' }] })),
  },
}));

describe('AgentService', () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('runs a tool call then returns the final reply', async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'search_knowledge',
                    arguments: JSON.stringify({ query: 'schedule' }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Classes run Saturday at 10am.',
            },
          },
        ],
      });

    const { AgentService } = await import('./agentService');
    const result = await AgentService.run({
      userId: 'user-1',
      endpointId: 'ep-1',
      message: 'When is class?',
      collections: [
        {
          schemaId: 'schema-a',
          schemaName: 'Main',
          className: 'Schema_a',
          systemPrompt: 'Be concise.',
          sourceType: 'schema',
        },
      ],
    });

    expect(result.reply).toBe('Classes run Saturday at 10am.');
    expect(result.conversationId).toBeTruthy();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('search_knowledge');
    expect(result.toolCalls[0].ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
