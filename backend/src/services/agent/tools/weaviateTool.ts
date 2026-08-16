import { WeaviateService, WEAVIATE_SEARCH_MAX } from '../../weaviateService';
import type { AgentToolContext, AgentToolDefinition, KnowledgeCollection } from '../types';

function resolveTargetCollections(
  ctx: AgentToolContext,
  schemaId?: string
): KnowledgeCollection[] {
  if (!schemaId) return ctx.collections;
  const match = ctx.collections.filter((c) => c.schemaId === schemaId);
  if (match.length === 0) {
    throw new Error(
      `schema_id ${schemaId} is not linked to this endpoint or is not published`
    );
  }
  return match;
}

export const searchKnowledgeTool: AgentToolDefinition = {
  name: 'search_knowledge',
  description:
    'Search the client knowledge base (Weaviate) for facts relevant to the user question. Prefer this before answering factual questions.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language or keyword search query',
      },
      mode: {
        type: 'string',
        enum: ['bm25', 'vector', 'hybrid'],
        description: 'bm25 = keyword, vector = semantic, hybrid = both (default hybrid)',
      },
      category: {
        type: 'string',
        description: 'Optional category filter (e.g. Program, Contact, Enrollment)',
      },
      schema_id: {
        type: 'string',
        description: 'Optional schema UUID to search a single linked collection',
      },
    },
    required: ['query'],
  },
  async execute(args, ctx) {
    const query = String(args.query ?? '').trim();
    if (!query) throw new Error('query is required');

    const modeRaw = typeof args.mode === 'string' ? args.mode : 'hybrid';
    const mode =
      modeRaw === 'bm25' || modeRaw === 'vector' || modeRaw === 'hybrid' ? modeRaw : 'hybrid';
    const category =
      typeof args.category === 'string' && args.category.trim()
        ? args.category.trim()
        : undefined;
    const schemaId =
      typeof args.schema_id === 'string' && args.schema_id.trim()
        ? args.schema_id.trim()
        : undefined;

    const targets = resolveTargetCollections(ctx, schemaId);
    if (targets.length === 0) {
      return { results: [], message: 'No published knowledge collections available' };
    }

    const results: Array<Record<string, unknown>> = [];
    for (const target of targets) {
      const hits = await WeaviateService.searchChunkObjects(
        target.className,
        query,
        mode,
        WEAVIATE_SEARCH_MAX,
        category
      );
      for (const hit of hits) {
        results.push({
          schema_id: target.schemaId,
          schema_name: target.schemaName,
          source_type: target.sourceType,
          content: hit.content,
          original_reference: hit.originalReference,
          category: hit.category,
          subcategory: hit.subcategory,
          score: hit.score,
        });
      }
    }

    results.sort((a, b) => {
      const sa = typeof a.score === 'number' ? a.score : 0;
      const sb = typeof b.score === 'number' ? b.score : 0;
      return sb - sa;
    });

    return { results: results.slice(0, WEAVIATE_SEARCH_MAX) };
  },
};
