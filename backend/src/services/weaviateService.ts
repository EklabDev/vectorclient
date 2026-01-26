import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { config } from 'dotenv';

config();

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

  /**
   * Create or update a collection in Weaviate for a schema
   * Collection name format: Schema_{schemaId} (sanitized)
   */
  static async syncSchemaToWeaviate(
    schemaId: string,
    schemaName: string,
    content: string,
    description?: string | null
  ): Promise<string> {
    try {
      const client = this.getClient();
      
      // Sanitize collection name: must start with uppercase, alphanumeric and underscores only
      // Weaviate requires class names to start with uppercase
      const sanitizedName = `Schema_${schemaId.replace(/-/g, '_')}`;
      const className = sanitizedName.charAt(0).toUpperCase() + sanitizedName.slice(1);

      // Check if collection already exists using REST API
      try {
        await client.schema.classGetter().withClassName(className).do();
        // Collection exists, delete it first
        await this.deleteCollectionFromWeaviate(className);
      } catch {
        // Collection doesn't exist, which is fine
      }

      // Create collection schema using REST API
      const collectionSchema = {
        class: className,
        description: description || `Schema: ${schemaName}`,
        properties: [
          {
            name: 'content',
            dataType: ['text'],
            description: 'Schema content/knowledge base',
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
        ],
        // Use none for vectorizer - can be changed to text2vec-openai or other vectorizers if needed
        vectorizer: 'none',
      };

      // Create the collection
      await client.schema.classCreator().withClass(collectionSchema).do();

      // Add the content as an object to the collection
      const objectData = {
        content: content,
        schemaId: schemaId,
        schemaName: schemaName,
        version: 1,
      };

      await client.data
        .creator()
        .withClassName(className)
        .withProperties(objectData)
        .do();

      return className;
    } catch (error) {
      console.error('Error syncing schema to Weaviate:', error);
      throw new Error(`Failed to sync schema to Weaviate: ${(error as Error).message}`);
    }
  }

  /**
   * Update schema content in Weaviate
   * Since Weaviate doesn't support direct updates, we delete old objects and create new ones
   */
  static async updateSchemaInWeaviate(
    schemaId: string,
    schemaName: string,
    content: string,
    version: number,
    description?: string | null
  ): Promise<string> {
    try {
      const client = this.getClient();
      
      const sanitizedName = `Schema_${schemaId.replace(/-/g, '_')}`;
      const className = sanitizedName.charAt(0).toUpperCase() + sanitizedName.slice(1);

      // Check if collection exists
      const existingCollection = await client.schema
        .classGetter()
        .withClassName(className)
        .do()
        .catch(() => null);

      if (!existingCollection) {
        // Collection doesn't exist, create it
        return await this.syncSchemaToWeaviate(schemaId, schemaName, content, description);
      }

      // Delete all existing objects in the collection
      const result = await client.graphql
        .get()
        .withClassName(className)
        .withFields('_additional { id }')
        .withLimit(1000)
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

      // Add new version of the content
      const objectData = {
        content: content,
        schemaId: schemaId,
        schemaName: schemaName,
        version: version,
      };

      await client.data
        .creator()
        .withClassName(className)
        .withProperties(objectData)
        .do();

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
   * Get schema content from Weaviate by collection name
   */
  static async getSchemaFromWeaviate(collectionName: string): Promise<any> {
    try {
      const client = this.getClient();
      
      const sanitizedName = collectionName.replace(/-/g, '_');
      const className = sanitizedName.charAt(0).toUpperCase() + sanitizedName.slice(1);

      const result = await client.graphql
        .get()
        .withClassName(className)
        .withFields('content schemaId schemaName version')
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
   * Search schema content in Weaviate
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
        .withFields('content schemaId schemaName version _additional { score }')
        .withLimit(limit)
        .do();

      return result.data?.Get?.[className] || [];
    } catch (error) {
      console.error('Error searching schema in Weaviate:', error);
      return [];
    }
  }
}
