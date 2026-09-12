import { describe, it, expect, vi, beforeEach } from 'vitest';
import { looksOffTopicHeuristic } from './topicHeuristics';
import { DEFAULT_TOPIC_FILTER } from '../../store/types';

const maxSimilarity = vi.fn();

vi.mock('../arcadeKnowledgeService', () => ({
  ArcadeKnowledgeService: {
    maxSimilarity: (...args: unknown[]) => maxSimilarity(...args),
  },
}));

describe('topic heuristics', () => {
  it('filters math and generic chatter without embeddings', () => {
    expect(looksOffTopicHeuristic('what is 2+2')).toBe(true);
    expect(looksOffTopicHeuristic('Write me a poem about cats')).toBe(true);
    expect(looksOffTopicHeuristic('When is Robotics Youth Squad?')).toBe(false);
  });
});

describe('evaluateTopicGate', () => {
  beforeEach(() => {
    maxSimilarity.mockReset();
  });

  it('refuses math without calling similarity', async () => {
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      userId: 'u1',
      message: 'what is 2 + 2',
      schemaIds: ['s1'],
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(false);
    expect(maxSimilarity).not.toHaveBeenCalled();
  });

  it('allows in-domain questions above similarity', async () => {
    maxSimilarity.mockResolvedValue(0.72);
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      userId: 'u1',
      message: 'When is robotics?',
      schemaIds: ['s1'],
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(true);
    expect(maxSimilarity).toHaveBeenCalled();
  });

  it('refuses low-similarity off-topic questions', async () => {
    maxSimilarity.mockResolvedValue(0.12);
    const { evaluateTopicGate } = await import('./topicGate');
    const result = await evaluateTopicGate({
      userId: 'u1',
      message: 'Who won the world cup?',
      schemaIds: ['s1'],
      filter: DEFAULT_TOPIC_FILTER,
    });
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.reply).toContain('organization');
  });
});

describe('mid-workflow answers skip the knowledge filter', () => {
  it('treats a short name as a collection slot, not an off-topic question', async () => {
    expect(looksOffTopicHeuristic('Jane Doe')).toBe(false);
  });
});
