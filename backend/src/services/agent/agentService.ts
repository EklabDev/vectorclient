import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import type {
  AgentRunInput,
  AgentRunResult,
  AgentToolContext,
  AgentToolDefinition,
} from './types';
import { searchKnowledgeTool } from './tools/weaviateTool';

const MAX_TOOL_TURNS = 8;
const DEFAULT_MODEL = 'gpt-4o-mini';

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function buildSystemPrompt(input: AgentRunInput): string {
  const prompts = input.collections
    .map((c) => c.systemPrompt?.trim())
    .filter((p): p is string => !!p);
  const schemaPrompt = prompts[0] || '';

  const collectionList = input.collections
    .map((c) => `- ${c.schemaName} (schema_id=${c.schemaId}, type=${c.sourceType})`)
    .join('\n');

  return [
    'You are a helpful assistant for a client knowledge base.',
    'Use tools to look up facts. Do not invent prices, schedules, URLs, phone numbers, or program details.',
    'If tools return nothing relevant, say you do not know and suggest contacting support when contact info is available.',
    schemaPrompt ? `Client instructions:\n${schemaPrompt}` : '',
    collectionList
      ? `Available knowledge collections:\n${collectionList}`
      : 'No published knowledge collections are linked. Say you lack knowledge base access.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function toOpenAITools(tools: AgentToolDefinition[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export class AgentService {
  /** Base tools always available; Redis/Neo4j tools register here when configured. */
  static getTools(): AgentToolDefinition[] {
    const tools: AgentToolDefinition[] = [searchKnowledgeTool];
    try {
      // Lazy require so Phase 1 works before Redis/Neo4j modules exist in all envs
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { cacheTools } = require('./tools/cacheTool') as {
        cacheTools: AgentToolDefinition[];
      };
      if (Array.isArray(cacheTools)) tools.push(...cacheTools);
    } catch {
      /* optional */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { graphTools } = require('./tools/graphTool') as {
        graphTools: AgentToolDefinition[];
      };
      if (Array.isArray(graphTools)) tools.push(...graphTools);
    } catch {
      /* optional */
    }
    return tools;
  }

  static async run(input: AgentRunInput): Promise<AgentRunResult> {
    const conversationId = input.conversationId?.trim() || uuidv4();
    const tools = this.getTools();
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    const ctx: AgentToolContext = {
      userId: input.userId,
      endpointId: input.endpointId,
      conversationId,
      collections: input.collections,
    };

    const history = await this.loadHistory(input.userId, conversationId);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(input) },
      ...history,
    ];

    if (input.extraContext && Object.keys(input.extraContext).length > 0) {
      messages.push({
        role: 'system',
        content: `Additional request context (JSON):\n${JSON.stringify(input.extraContext)}`,
      });
    }

    messages.push({ role: 'user', content: input.message });

    const openai = getOpenAI();
    const model = process.env.AGENT_MODEL || DEFAULT_MODEL;
    const toolCallsLog: AgentRunResult['toolCalls'] = [];
    let reply = '';

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools: tools.length > 0 ? toOpenAITools(tools) : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      });

      const choice = completion.choices[0]?.message;
      if (!choice) {
        reply = 'Sorry, I could not generate a response.';
        break;
      }

      messages.push(choice);

      const calls = choice.tool_calls;
      if (!calls || calls.length === 0) {
        reply = choice.content?.trim() || '';
        break;
      }

      for (const call of calls) {
        if (call.type !== 'function') continue;
        const name = call.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }

        const tool = toolMap.get(name);
        let result: unknown;
        let ok = true;
        try {
          if (!tool) throw new Error(`Unknown tool: ${name}`);
          result = await tool.execute(args, ctx);
        } catch (err) {
          ok = false;
          result = { error: err instanceof Error ? err.message : 'Tool failed' };
        }
        toolCallsLog.push({ name, args, ok });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!reply) {
      reply = 'Sorry, I reached the tool-call limit without a final answer. Please try again.';
    }

    await this.saveTurn(input.userId, conversationId, input.message, reply);

    return { reply, conversationId, toolCalls: toolCallsLog };
  }

  private static async loadHistory(
    userId: string,
    conversationId: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RedisService } = require('../redisService') as {
        RedisService: {
          getConversation: (
            userId: string,
            conversationId: string
          ) => Promise<Array<{ role: 'user' | 'assistant'; content: string }>>;
        };
      };
      const turns = await RedisService.getConversation(userId, conversationId);
      return turns.map((t) => ({ role: t.role, content: t.content }));
    } catch {
      return [];
    }
  }

  private static async saveTurn(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RedisService } = require('../redisService') as {
        RedisService: {
          appendConversationTurn: (
            userId: string,
            conversationId: string,
            role: 'user' | 'assistant',
            content: string
          ) => Promise<void>;
        };
      };
      await RedisService.appendConversationTurn(userId, conversationId, 'user', userMessage);
      await RedisService.appendConversationTurn(
        userId,
        conversationId,
        'assistant',
        assistantReply
      );
    } catch {
      /* redis optional until Phase 2 */
    }
  }
}
