import type { AgentToolDefinition } from '../types';
import { Neo4jService, GraphEntityType, GraphRelType } from '../../neo4jService';

const ENTITY_TYPES: GraphEntityType[] = [
  'Organization',
  'Program',
  'Location',
  'Schedule',
  'Contact',
  'WebPage',
  'ChunkRef',
];

const REL_TYPES: GraphRelType[] = [
  'OFFERS',
  'LOCATED_AT',
  'HAS_SCHEDULE',
  'HAS_CONTACT',
  'MENTIONS',
];

function asEntityType(value: unknown): GraphEntityType {
  const v = String(value ?? '');
  if (!ENTITY_TYPES.includes(v as GraphEntityType)) {
    throw new Error(`Invalid entity type. Allowed: ${ENTITY_TYPES.join(', ')}`);
  }
  return v as GraphEntityType;
}

export const graphGetEntityTool: AgentToolDefinition = {
  name: 'graph_get_entity',
  description:
    'Look up a structured entity in the client knowledge graph (programs, locations, contacts, etc.).',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ENTITY_TYPES },
      name: { type: 'string', description: 'Entity name' },
    },
    required: ['type', 'name'],
  },
  async execute(args, ctx) {
    if (!Neo4jService.isEnabled()) {
      return { entity: null, message: 'Graph database is not configured' };
    }
    const type = asEntityType(args.type);
    const name = String(args.name ?? '').trim();
    if (!name) throw new Error('name is required');
    const entity = await Neo4jService.getEntity(ctx.userId, type, name);
    return { entity };
  },
};

export const graphRelatedTool: AgentToolDefinition = {
  name: 'graph_related',
  description:
    'Find entities related to a given entity in the client knowledge graph (depth 1–2).',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ENTITY_TYPES },
      name: { type: 'string' },
      relationship: {
        type: 'string',
        enum: REL_TYPES,
        description: 'Optional relationship filter',
      },
      depth: { type: 'number', description: '1 or 2 (default 1)' },
    },
    required: ['type', 'name'],
  },
  async execute(args, ctx) {
    if (!Neo4jService.isEnabled()) {
      return { related: [], message: 'Graph database is not configured' };
    }
    const type = asEntityType(args.type);
    const name = String(args.name ?? '').trim();
    if (!name) throw new Error('name is required');
    const rel =
      typeof args.relationship === 'string' && REL_TYPES.includes(args.relationship as GraphRelType)
        ? (args.relationship as GraphRelType)
        : undefined;
    const depth = typeof args.depth === 'number' ? args.depth : 1;
    const related = await Neo4jService.findRelated(ctx.userId, type, name, rel, depth);
    return { related };
  },
};

export const graphTools: AgentToolDefinition[] = [graphGetEntityTool, graphRelatedTool];
