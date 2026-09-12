import { ArcadeKnowledgeService } from '../arcadeKnowledgeService';
import { looksOffTopicHeuristic } from './topicHeuristics';
import type { TopicFilter } from '../../store/types';

export type TopicGateResult =
  | { allow: true; reason: 'on_topic' | 'heuristic_skip' }
  | { allow: false; reason: 'off_topic' | 'heuristic'; reply: string };

export async function evaluateTopicGate(input: {
  userId: string;
  message: string;
  schemaIds: string[];
  filter: TopicFilter;
}): Promise<TopicGateResult> {
  if (!input.filter.enabled) return { allow: true, reason: 'heuristic_skip' };
  if (looksOffTopicHeuristic(input.message)) {
    return { allow: false, reason: 'heuristic', reply: input.filter.offTopicReply };
  }
  if (input.schemaIds.length === 0) {
    return { allow: true, reason: 'heuristic_skip' };
  }
  try {
    const score = await ArcadeKnowledgeService.maxSimilarity(
      input.userId,
      input.message,
      input.schemaIds
    );
    if (score < input.filter.minSimilarity) {
      return { allow: false, reason: 'off_topic', reply: input.filter.offTopicReply };
    }
    return { allow: true, reason: 'on_topic' };
  } catch (err) {
    console.error('Topic gate similarity failed, allowing message:', err);
    return { allow: true, reason: 'heuristic_skip' };
  }
}
