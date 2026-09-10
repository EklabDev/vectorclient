import OpenAI from 'openai';
import { Neo4jService, GraphEntityType, GraphRelType } from './neo4jService';

const EXTRACT_PROMPT = `Extract entities and relationships from knowledge chunks for a client knowledge graph.
Return ONLY JSON:
{
  "entities": [{"type":"Organization|Program|Location|Schedule|Contact","name":"...","props":{}}],
  "relationships": [{"fromType":"...","fromName":"...","relType":"OFFERS|LOCATED_AT|HAS_SCHEDULE|HAS_CONTACT|MENTIONS","toType":"...","toName":"..."}]
}
Rules:
- Use exact names from the text. Do not invent entities.
- Prefer Program, Location, Schedule, Contact, Organization types.
- Keep props small (strings only).`;

type Extracted = {
  entities: Array<{ type: GraphEntityType; name: string; props?: Record<string, unknown> }>;
  relationships: Array<{
    fromType: GraphEntityType;
    fromName: string;
    relType: GraphRelType;
    toType: GraphEntityType;
    toName: string;
  }>;
};

const ALLOWED_TYPES = new Set([
  'Organization',
  'Program',
  'Location',
  'Schedule',
  'Contact',
  'WebPage',
  'ChunkRef',
]);
const ALLOWED_RELS = new Set([
  'OFFERS',
  'LOCATED_AT',
  'HAS_SCHEDULE',
  'HAS_CONTACT',
  'MENTIONS',
]);

export class GraphExtractService {
  static async extractAndUpsert(
    userId: string,
    chunks: Array<{ content: string; id?: string }>,
    sourceMeta: { sourceId?: string; sourceUrl?: string } = {}
  ): Promise<{ entities: number; relationships: number }> {
    if (!Neo4jService.isEnabled() || chunks.length === 0) {
      return { entities: 0, relationships: 0 };
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sample = chunks
      .slice(0, 40)
      .map((c, i) => `[${i}] ${c.content}`)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model: process.env.AGENT_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        {
          role: 'user',
          content: `Source meta: ${JSON.stringify(sourceMeta)}\n\nChunks:\n${sample}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || '{}';
    let parsed: Extracted;
    try {
      parsed = JSON.parse(raw) as Extracted;
    } catch {
      return { entities: 0, relationships: 0 };
    }

    let entityCount = 0;
    for (const e of parsed.entities || []) {
      if (!ALLOWED_TYPES.has(e.type) || !e.name?.trim()) continue;
      const props = { ...(e.props || {}), ...(sourceMeta.sourceId ? { sourceId: sourceMeta.sourceId } : {}) };
      await Neo4jService.upsertEntity(userId, e.type, e.name, props);
      entityCount += 1;
    }

    let relCount = 0;
    for (const r of parsed.relationships || []) {
      if (
        !ALLOWED_TYPES.has(r.fromType) ||
        !ALLOWED_TYPES.has(r.toType) ||
        !ALLOWED_RELS.has(r.relType) ||
        !r.fromName?.trim() ||
        !r.toName?.trim()
      ) {
        continue;
      }
      // Ensure endpoints exist
      await Neo4jService.upsertEntity(userId, r.fromType, r.fromName, {});
      await Neo4jService.upsertEntity(userId, r.toType, r.toName, {});
      await Neo4jService.upsertRel(
        userId,
        r.fromType,
        r.fromName,
        r.relType,
        r.toType,
        r.toName
      );
      relCount += 1;
    }

    return { entities: entityCount, relationships: relCount };
  }
}
