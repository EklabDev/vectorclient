import { Endpoints } from '../../store/endpoints';
import { Schemas } from '../../store/schemas';
import { Scrape } from '../../store/scrape';
import type { KnowledgeCollection } from '../agent/types';

export async function loadScrapeCollectionsForEndpoint(
  endpointId: string
): Promise<KnowledgeCollection[]> {
  const links = await Endpoints.schemaLinks(endpointId);
  if (links.length === 0) return [];
  const first = await Schemas.findById(links[0].schemaId);
  if (!first) return [];
  const schemaIds = new Set(links.map((s) => s.schemaId));
  const sources = await Scrape.listActiveByUser(first.userId);
  const collections: KnowledgeCollection[] = [];
  for (const source of sources) {
    if (source.schemaId && !schemaIds.has(source.schemaId)) continue;
    collections.push({
      schemaId: source.id,
      schemaName: source.name,
      className: source.id,
      systemPrompt: null,
      sourceType: 'scrape',
    });
  }
  return collections;
}
