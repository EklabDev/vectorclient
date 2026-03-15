import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { config } from 'dotenv';
import { ChunkingService, Chunk } from './chunkingService';

config();

const CATEGORY_MAX_LENGTH = 50;

function truncateCategory(value: string | undefined | null): string | undefined {
  if (value == null || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length <= CATEGORY_MAX_LENGTH ? trimmed : trimmed.slice(0, CATEGORY_MAX_LENGTH);
}

function chunkPropertiesForWeaviate(
  chunk: Chunk,
  schemaId: string,
  schemaName: string,
  version: number
): Record<string, unknown> {
  const category = truncateCategory(chunk.category);
  const subcategory = truncateCategory(chunk.subcategory);
  return {
    content: chunk.content,
    originalReference: chunk.originalReference,
    schemaId,
    schemaName,
    version,
    chunkIndex: chunk.chunkIndex,
    ...(category !== undefined && { category }),
    ...(subcategory !== undefined && { subcategory }),
  };
}

export class WeaviateService {
  private static client: WeaviateClient | null = null;

  private static getClient(): WeaviateClient {
    if (!this.client) {
      const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
      const weaviateApiKey = process.env.WEAVIATE_API_KEY;

      // Parse URL to get scheme and host
      let scheme: 'http' | 'https' = 'http';
      let host = 'localhost:8080';

      try {
        const url = new URL(weaviateUrl);
        scheme = url.protocol.replace(':', '') as 'http' | 'https';
        host = url.host;
      } catch {
        // If URL parsing fails, try to extract manually
        if (weaviateUrl.startsWith('https://')) {
          scheme = 'https';
          host = weaviateUrl.replace('https://', '').split('/')[0];
        } else if (weaviateUrl.startsWith('http://')) {
          scheme = 'http';
          host = weaviateUrl.replace('http://', '').split('/')[0];
        } else {
          host = weaviateUrl.split('/')[0];
        }
      }

      const clientConfig: any = {
        scheme,
        host,
      };

      if (weaviateApiKey) {
        clientConfig.apiKey = new ApiKey(weaviateApiKey);
      }

      this.client = weaviate.client(clientConfig);
    }

    return this.client;
  }

  private static getClassName(schemaId: string): string {
    const sanitizedName = `Schema_${schemaId.replace(/-/g, '_')}`;
    return sanitizedName.charAt(0).toUpperCase() + sanitizedName.slice(1);
  }

  /**
   * Create or update a collection in Weaviate for a schema.
   * Chunks content via OpenAI and stores each chunk as a separate object.
   * Collection name format: Schema_{schemaId} (sanitized)
   */
  static async syncSchemaToWeaviate(
    schemaId: string,
    schemaName: string,
    content: string,
    description?: string | null
  ): Promise<string> {
    const client = this.getClient();
    const className = this.getClassName(schemaId);

    // Chunk content BEFORE touching Weaviate — if this fails, Weaviate is untouched
    const chunks = await ChunkingService.chunkContent(content);

    try {
      // Delete existing collection if present
      try {
        await client.schema.classGetter().withClassName(className).do();
        await this.deleteCollectionFromWeaviate(className);
      } catch {
        // Collection doesn't exist, which is fine
      }

      // Create collection with chunk-level properties
      const collectionSchema = {
        class: className,
        description: description || `Schema: ${schemaName}`,
        properties: [
          {
            name: 'content',
            dataType: ['text'],
            description: 'Chunk text — a small factual unit of the schema',
          },
          {
            name: 'originalReference',
            dataType: ['text'],
            description: 'Exact sentence or span from the source schema content',
          },
          {
            name: 'schemaId',
            dataType: ['text'],
            description: 'Reference to schema ID in PostgreSQL',
          },
          {
            name: 'schemaName',
            dataType: ['text'],
            description: 'Schema name',
          },
          {
            name: 'version',
            dataType: ['int'],
            description: 'Schema version',
          },
          {
            name: 'chunkIndex',
            dataType: ['int'],
            description: 'Order index of the chunk within the schema',
          },
          {
            name: 'category',
            dataType: ['text'],
            description: 'Short semantic label for the chunk (max 50 chars)',
          },
          {
            name: 'subcategory',
            dataType: ['text'],
            description: 'Short semantic sub-label for the chunk (max 50 chars)',
          },
        ],
        vectorizer: 'text2vec-openai',
      };

      await client.schema.classCreator().withClass(collectionSchema).do();

      // Insert each chunk as a separate object
      for (const chunk of chunks) {
        await client.data
          .creator()
          .withClassName(className)
          .withProperties(chunkPropertiesForWeaviate(chunk, schemaId, schemaName, 1))
          .do();
      }

      return className;
    } catch (error) {
      console.error('Error syncing schema to Weaviate:', error);
      throw new Error(`Failed to sync schema to Weaviate: ${(error as Error).message}`);
    }
  }

  /**
   * Update schema content in Weaviate using chunked full-replace.
   * Chunks content via OpenAI, deletes existing objects, inserts new chunks.
   *
   * Rollback note: If Weaviate writes fail after deleting old objects, the collection
   * will be empty until the next successful publish/sync restores the data.
   */
  static async updateSchemaInWeaviate(
    schemaId: string,
    schemaName: string,
    content: string,
    version: number,
    description?: string | null
  ): Promise<string> {
    const client = this.getClient();
    const className = this.getClassName(schemaId);

    // Chunk content BEFORE touching Weaviate — if this fails, Weaviate is untouched
    const chunks = await ChunkingService.chunkContent(content);

    try {
      // Check if collection exists
      const existingCollection = await client.schema
        .classGetter()
        .withClassName(className)
        .do()
        .catch(() => null);

      if (!existingCollection) {
        // Collection doesn't exist — create it via sync (which also chunks, but
        // we already have chunks so we recreate inline to avoid double-chunking)
        const collectionSchema = {
          class: className,
          description: description || `Schema: ${schemaName}`,
          properties: [
            { name: 'content', dataType: ['text'], description: 'Chunk text' },
            { name: 'originalReference', dataType: ['text'], description: 'Source sentence/span' },
            { name: 'schemaId', dataType: ['text'], description: 'Schema ID in PostgreSQL' },
            { name: 'schemaName', dataType: ['text'], description: 'Schema name' },
            { name: 'version', dataType: ['int'], description: 'Schema version' },
            { name: 'chunkIndex', dataType: ['int'], description: 'Chunk order index' },
            { name: 'category', dataType: ['text'], description: 'Short semantic label (max 50 chars)' },
            { name: 'subcategory', dataType: ['text'], description: 'Short semantic sub-label (max 50 chars)' },
          ],
          vectorizer: 'text2vec-openai',
        };

        await client.schema.classCreator().withClass(collectionSchema).do();
      } else {
        // Delete all existing objects in the collection
        const result = await client.graphql
          .get()
          .withClassName(className)
          .withFields('_additional { id }')
          .withLimit(10000)
          .do();

        if (result.data?.Get?.[className]) {
          const objects = result.data.Get[className] as Array<{ _additional: { id: string } }>;
          for (const obj of objects) {
            await client.data
              .deleter()
              .withClassName(className)
              .withId(obj._additional.id)
              .do()
              .catch((err) => {
                console.warn(`Failed to delete object ${obj._additional.id}:`, err);
              });
          }
        }
      }

      // Insert new chunks
      for (const chunk of chunks) {
        await client.data
          .creator()
          .withClassName(className)
          .withProperties(chunkPropertiesForWeaviate(chunk, schemaId, schemaName, version))
          .do();
      }

      return className;
    } catch (error) {
      console.error('Error updating schema in Weaviate:', error);
      throw new Error(`Failed to update schema in Weaviate: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a collection from Weaviate
   */
  static async deleteCollectionFromWeaviate(collectionName: string): Promise<void> {
    try {
      const client = this.getClient();

      // Sanitize collection name
      const sanitizedName = collectionName.replace(/-/g, '_');
      const className = sanitizedName.charAt(0).toUpperCase() + sanitizedName.slice(1);

      await client.schema.classDeleter().withClassName(className).do();
    } catch (error) {
      // If collection doesn't exist, that's okay
      if ((error as any).body?.error?.[0]?.message?.includes('not found')) {
        return;
      }
      console.error('Error deleting collection from Weaviate:', error);
      throw new Error(`Failed to delete collection from Weaviate: ${(error as Error).message}`);
    }
  }

  /**
   * Get schema chunks from Weaviate by collection name
   */
  static async getSchemaFromWeaviate(collectionName: string): Promise<any> {
    try {
      const client = this.getClient();

      const sanitizedName = collectionName.replace(/-/g, '_');
      const className = sanitizedName.charAt(0).toUpperCase() + sanitizedName.slice(1);

      const result = await client.graphql
        .get()
        .withClassName(className)
        .withFields('content originalReference schemaId schemaName version chunkIndex category subcategory')
        .withLimit(1)
        .do();

      if (result.data?.Get?.[className] && Array.isArray(result.data.Get[className]) && result.data.Get[className].length > 0) {
        return result.data.Get[className][0];
      }

      return null;
    } catch (error) {
      console.error('Error getting schema from Weaviate:', error);
      return null;
    }
  }

  /**
   * Search schema chunks in Weaviate
   */
  static async searchSchema(
    collectionName: string,
    query: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const client = this.getClient();

      const sanitizedName = collectionName.replace(/-/g, '_');
      const className = sanitizedName.charAt(0).toUpperCase() + sanitizedName.slice(1);

      // Use BM25 search (keyword-based)
      const result = await client.graphql
        .get()
        .withClassName(className)
        .withBm25({ query: query })
        .withFields('content originalReference schemaId schemaName version chunkIndex _additional { score }')
        .withLimit(limit)
        .do();

      return result.data?.Get?.[className] || [];
    } catch (error) {
      console.error('Error searching schema in Weaviate:', error);
      return [];
    }
  }
}
