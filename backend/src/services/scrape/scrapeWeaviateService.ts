import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { ChunkingService, Chunk } from '../chunkingService';
import { WeaviateService } from '../weaviateService';

function getClient(): WeaviateClient {
  const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
  const weaviateApiKey = process.env.WEAVIATE_API_KEY;
  let scheme: 'http' | 'https' = 'http';
  let host = 'localhost:8080';
  try {
    const url = new URL(weaviateUrl);
    scheme = url.protocol.replace(':', '') as 'http' | 'https';
    host = url.host;
  } catch {
    host = weaviateUrl.replace(/^https?:\/\//, '').split('/')[0];
  }
  const clientConfig: { scheme: 'http' | 'https'; host: string; apiKey?: ApiKey } = { scheme, host };
  if (weaviateApiKey) clientConfig.apiKey = new ApiKey(weaviateApiKey);
  return weaviate.client(clientConfig);
}

export function scrapeClassName(sourceId: string): string {
  const sanitized = `Scrape_${sourceId.replace(/-/g, '_')}`;
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
}

export class ScrapeWeaviateService {
  static async replaceSourceChunks(
    sourceId: string,
    sourceName: string,
    pages: Array<{ url: string; text: string }>
  ): Promise<{ className: string; chunkCount: number }> {
    const client = getClient();
    const className = scrapeClassName(sourceId);

    const allChunks: Array<Chunk & { sourceUrl: string }> = [];
    for (const page of pages) {
      const chunks = await ChunkingService.chunkContent(page.text);
      for (const chunk of chunks) {
        allChunks.push({ ...chunk, sourceUrl: page.url });
      }
    }

    try {
      await client.schema.classGetter().withClassName(className).do();
      await WeaviateService.deleteCollectionFromWeaviate(className);
    } catch {
      /* collection may not exist */
    }

    await client.schema
      .classCreator()
      .withClass({
        class: className,
        description: `Scraped source: ${sourceName}`,
        properties: [
          { name: 'content', dataType: ['text'] },
          { name: 'originalReference', dataType: ['text'] },
          { name: 'schemaId', dataType: ['text'] },
          { name: 'schemaName', dataType: ['text'] },
          { name: 'version', dataType: ['int'] },
          { name: 'chunkIndex', dataType: ['int'] },
          { name: 'category', dataType: ['text'] },
          { name: 'subcategory', dataType: ['text'] },
          { name: 'sourceUrl', dataType: ['text'] },
          { name: 'sourceType', dataType: ['text'] },
        ],
        vectorizer: 'text2vec-openai',
      })
      .do();

    let index = 0;
    for (const chunk of allChunks) {
      const category = chunk.category?.trim().slice(0, 50);
      const subcategory = chunk.subcategory?.trim().slice(0, 50);
      await client.data
        .creator()
        .withClassName(className)
        .withProperties({
          content: chunk.content,
          originalReference: chunk.originalReference,
          schemaId: sourceId,
          schemaName: sourceName,
          version: 1,
          chunkIndex: index++,
          ...(category ? { category } : {}),
          ...(subcategory ? { subcategory } : {}),
          sourceUrl: chunk.sourceUrl,
          sourceType: 'scrape',
        })
        .do();
    }

    return { className, chunkCount: allChunks.length };
  }
}
