import OpenAI from 'openai';
import type { TopicFilter } from '../../store/types';
import type { KnowledgeCollection } from './types';

export type TopicGateResult =
  | { allow: true; reason: 'on_topic' | 'filter_disabled' | 'no_collections' | 'classifier_error' }
  | { allow: false; reason: 'off_topic'; reply: string };

export type TopicHistoryTurn = { role: 'user' | 'assistant'; content: string };

const DEFAULT_MODEL = 'gpt-4o-mini';
const PROMPT_SNIPPET = 400;
const HISTORY_EXCHANGES = 5;
const HISTORY_SNIPPET = 400;

type StoredExchange = { question: string; reply: string };

function userContent(message: string, history: TopicHistoryTurn[] | undefined): string {
  const prior = recentExchanges(history);
  if (prior.length === 0) return message;
  const lines = prior.map(
    (turn, index) => `${index + 1}. question: ${turn.question}\n   reply: ${turn.reply}`
  );
  return `Last stored questions and replies for this user and session:\n${lines.join('\n')}\n\nCurrent message:\n${message}`;
}

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function collectionContext(collections: KnowledgeCollection[]): string {
  return collections
    .map((c) => {
      const prompt = c.systemPrompt?.trim().slice(0, PROMPT_SNIPPET);
      return prompt ? `- ${c.schemaName} (${c.sourceType}): ${prompt}` : `- ${c.schemaName} (${c.sourceType})`;
    })
    .join('\n');
}

function recentExchanges(history: TopicHistoryTurn[] | undefined): StoredExchange[] {
  const exchanges: StoredExchange[] = [];
  let question = '';
  for (const turn of history || []) {
    const content = turn.content.trim().slice(0, HISTORY_SNIPPET);
    if (!content) continue;
    if (turn.role === 'user') {
      question = content;
      continue;
    }
    if (turn.role === 'assistant' && question) {
      exchanges.push({ question, reply: content });
      question = '';
    }
  }
  return exchanges.slice(-HISTORY_EXCHANGES);
}

const NEW_TOPIC = /\b(poem|joke|song|capital of|weather|world cup|president|recipe|homework)\b|\d+\s*[-+*/]\s*\d+/i;

function continuesPassedTopic(message: string, history: TopicHistoryTurn[] | undefined): boolean {
  if (recentExchanges(history).length === 0) return false;
  const text = message.trim();
  if (!text || text.length > 180 || NEW_TOPIC.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (/\b(it|its|that|this|they|them|those)\b/i.test(text) && words.length <= 14) return true;
  if (words.length <= 4 && /^(when|where|how|who|what|why|and|also)\b/i.test(text)) return true;
  return false;
}

export async function evaluateTopicGate(input: {
  message: string;
  collections: KnowledgeCollection[];
  filter: TopicFilter;
  history?: TopicHistoryTurn[];
}): Promise<TopicGateResult> {
  if (!input.filter.enabled) return { allow: true, reason: 'filter_disabled' };
  if (input.collections.length === 0) return { allow: true, reason: 'no_collections' };
  if (continuesPassedTopic(input.message, input.history)) return { allow: true, reason: 'on_topic' };

  try {
    const openai = getOpenAI();
    const model = process.env.AGENT_MODEL || DEFAULT_MODEL;
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Decide if a user message is relevant to the knowledge collections below.',
            'Relevant means it asks about those collections or the organization they describe: services, products, store, schedules, programs, enrollment, contacts, or site content.',
            'A question that names the organization or collection is relevant even if the wording is informal.',
            'Unrelated requests (math, poems, sports scores, general world knowledge) are not relevant.',
            'When stored questions and replies are included, they are the last five exchanges already saved for this same user and session.',
            'A question is relevant when it is based on one of those questions or replies, even if it leaves out the subject. Example: after a reply that the store is coming soon, "when will it open" is relevant.',
            'A new unrelated request is not relevant just because earlier replies were on topic.',
            'Reply with JSON only: {"relevant": true} or {"relevant": false}.',
            '',
            'Collections:',
            collectionContext(input.collections),
          ].join('\n'),
        },
        { role: 'user', content: userContent(input.message, input.history) },
      ],
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as { relevant?: boolean };
    if (parsed.relevant === false) {
      return { allow: false, reason: 'off_topic', reply: input.filter.offTopicReply };
    }
    return { allow: true, reason: 'on_topic' };
  } catch (err) {
    console.error('Topic gate classifier failed, allowing message:', err);
    return { allow: true, reason: 'classifier_error' };
  }
}
