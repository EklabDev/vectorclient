import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_TOPIC_FILTER } from '../../store/types';
import type { KnowledgeCollection } from './types';

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

const collections: KnowledgeCollection[] = [
  {
    schemaId: 's1',
    schemaName: 'Programs',
    className: 's1',
    systemPrompt: 'Answer questions about class schedules and enrollment.',
    sourceType: 'schema',
  },
];

function completion(relevant: boolean) {
  return {
    choices: [{ message: { content: JSON.stringify({ relevant }) } }],
  };
}

describe('evaluateTopicGate', () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('allows immediately when the filter is disabled', async () => {
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'what is 2 + 2',
      collections,
      filter: { ...DEFAULT_TOPIC_FILTER, enabled: false },
    });
    expect(result.allow).toBe(true);
    if (result.allow) expect(result.reason).toBe('filter_disabled');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('allows when no collections are linked', async () => {
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'Who won the world cup?',
      collections: [],
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(true);
    if (result.allow) expect(result.reason).toBe('no_collections');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns the off-topic reply when the classifier says not relevant', async () => {
    createMock.mockResolvedValue(completion(false));
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'Write me a poem about cats',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reply).toContain('organization');
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('allows the message when the classifier says it is relevant', async () => {
    createMock.mockResolvedValue(completion(true));
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'When is robotics?',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(true);
    if (result.allow) expect(result.reason).toBe('on_topic');
  });

  it('allows a follow-up that continues a passed store answer', async () => {
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'when will it open',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
      history: [
        { role: 'user', content: 'does it has a store' },
        { role: 'assistant', content: 'No for now, but it will be soon.' },
      ],
    });
    expect(result.allow).toBe(true);
    if (result.allow) expect(result.reason).toBe('on_topic');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('still classifies an unrelated follow-up after a passed turn', async () => {
    createMock.mockResolvedValue(completion(false));
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'Write me a poem about cats',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
      history: [
        { role: 'user', content: 'does it has a store' },
        { role: 'assistant', content: 'No for now, but it will be soon.' },
      ],
    });
    expect(result.allow).toBe(false);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('does not treat a pronoun question as a follow-up without passed history', async () => {
    createMock.mockResolvedValue(completion(false));
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'when will it open',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(false);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('sends only prior passed turns when judging a follow-up', async () => {
    createMock.mockResolvedValue(completion(true));
    const { evaluateTopicGate } = await import('./topicGate');
    await evaluateTopicGate({
      message: 'Can you tell me the membership price for next semester?',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
      history: [
        { role: 'user', content: 'Does EKLab have a store?' },
        { role: 'assistant', content: 'The store is coming soon.' },
        { role: 'user', content: '   ' },
      ],
    });
    const sent = createMock.mock.calls[0][0] as { messages: Array<{ content: string }> };
    const user = sent.messages[1].content;
    expect(user).toContain('Last stored questions and replies for this user and session');
    expect(user).toContain('question: Does EKLab have a store?');
    expect(user).toContain('reply: The store is coming soon.');
    expect(user).toContain('Current message:\nCan you tell me the membership price for next semester?');
    expect(user).not.toContain('question:    ');
  });

  it('uses only the last five stored question and reply pairs', async () => {
    createMock.mockResolvedValue(completion(true));
    const { evaluateTopicGate } = await import('./topicGate');
    const history = Array.from({ length: 6 }, (_, i) => [
      { role: 'user' as const, content: `question ${i + 1}` },
      { role: 'assistant' as const, content: `reply ${i + 1}` },
    ]).flat();
    await evaluateTopicGate({
      message: 'Can you tell me the membership price for next semester?',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
      history,
    });
    const sent = createMock.mock.calls[0][0] as { messages: Array<{ content: string }> };
    const user = sent.messages[1].content;
    expect(user).not.toContain('question 1');
    expect(user).not.toContain('reply 1');
    expect(user).toContain('question 2');
    expect(user).toContain('reply 6');
  });

  it('does not treat a question as a follow-up when its reply was not stored', async () => {
    createMock.mockResolvedValue(completion(false));
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'when will it open',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
      history: [{ role: 'user', content: 'does it has a store' }],
    });
    expect(result.allow).toBe(false);
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('allows the message when the classifier throws', async () => {
    createMock.mockRejectedValue(new Error('openai down'));
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      message: 'When is robotics?',
      collections,
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(true);
    if (result.allow) expect(result.reason).toBe('classifier_error');
  });
});
