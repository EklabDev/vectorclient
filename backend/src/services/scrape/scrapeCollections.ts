import { db } from '../../config/database';
import { scrapeSources, endpointSchemas, schemas } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import type { KnowledgeCollection } from '../agent/types';
import { scrapeClassName } from './scrapeWeaviateService';

/**
 * Load scrape Weaviate collections for an endpoint:
 * - scrape sources owned by the same user as the endpoint's schemas
 * - optionally linked via schemaId to a schema on the endpoint
 * - must be active and have a weaviate collection
 */
export async function loadScrapeCollectionsForEndpoint(
  endpointId: string
): Promise<KnowledgeCollection[]> {
  const linkedSchemas = await db
    .select({
      schemaId: schemas.id,
      userId: schemas.userId,
    })
    .from(endpointSchemas)
    .innerJoin(schemas, eq(endpointSchemas.schemaId, schemas.id))
    .where(eq(endpointSchemas.endpointId, endpointId));

  if (linkedSchemas.length === 0) return [];

  const userId = linkedSchemas[0].userId;
  const schemaIds = new Set(linkedSchemas.map((s) => s.schemaId));

  const sources = await db
    .select()
    .from(scrapeSources)
    .where(and(eq(scrapeSources.userId, userId), eq(scrapeSources.isActive, true)));

  const collections: KnowledgeCollection[] = [];
  for (const source of sources) {
    if (!source.weaviateCollectionId) continue;
    // Include if unlinked (all endpoint schemas of this user) OR linked to an endpoint schema
    if (source.schemaId && !schemaIds.has(source.schemaId)) continue;
    collections.push({
      schemaId: source.id,
      schemaName: source.name,
      className: source.weaviateCollectionId || scrapeClassName(source.id),
      systemPrompt: null,
      sourceType: 'scrape',
    });
  }
  return collections;
}
