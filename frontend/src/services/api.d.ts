export interface WeaviateChunkObject {
    id: string;
    content?: string;
    originalReference?: string;
    schemaId?: string;
    schemaName?: string;
    version?: number;
    chunkIndex?: number;
    category?: string;
    subcategory?: string;
    score?: number;
}
export declare class ApiClient {
    static request<T>(endpoint: string, options?: RequestInit): Promise<T>;
    static login(username: string, password: string): Promise<unknown>;
    static register(username: string, password: string, email: string, displayName: string): Promise<unknown>;
    static getEndpoints(): Promise<unknown>;
    static getEndpoint(id: string): Promise<unknown>;
    static createEndpoint(data: any): Promise<unknown>;
    static updateEndpoint(id: string, data: any): Promise<unknown>;
    static deleteEndpoint(id: string): Promise<unknown>;
    static getSchemas(): Promise<unknown>;
    static getSchema(id: string): Promise<unknown>;
    static createSchema(data: any): Promise<unknown>;
    static updateSchema(id: string, data: any): Promise<unknown>;
    static deleteSchema(id: string): Promise<unknown>;
    /** Batch Weaviate object counts for schema cards (published only). */
    static postWeaviateBatchCounts(ids: string[]): Promise<{
        counts: Record<string, number>;
    }>;
    static getWeaviateObjects(schemaId: string): Promise<{
        objects: WeaviateChunkObject[];
        truncated: boolean;
    }>;
    static getWeaviateCount(schemaId: string): Promise<{
        count: number;
    }>;
    static searchWeaviateObjects(schemaId: string, body: {
        query: string;
        mode: 'bm25' | 'vector';
    }): Promise<{
        objects: WeaviateChunkObject[];
    }>;
    static createWeaviateObject(schemaId: string, body: {
        content: string;
        originalReference?: string;
        category?: string;
        subcategory?: string;
    }): Promise<{
        id: string;
        chunkIndex: number;
    }>;
    /** Merge-update chunk fields (omit a key to leave that field unchanged in Weaviate). */
    static patchWeaviateChunk(schemaId: string, objectId: string, body: {
        content?: string;
        category?: string;
        subcategory?: string;
    }): Promise<{
        ok: boolean;
    }>;
    static deleteWeaviateObject(schemaId: string, objectId: string): Promise<{
        ok: boolean;
    }>;
    static getTokens(): Promise<unknown>;
    static createToken(tokenName: string, expiresIn?: number): Promise<unknown>;
    static revokeToken(id: string): Promise<unknown>;
    static addTokensToEndpoint(endpointId: string, tokenIds: string[]): Promise<unknown>;
    static removeTokenFromEndpoint(endpointId: string, tokenId: string): Promise<unknown>;
    static addSchemasToEndpoint(endpointId: string, schemaIds: string[]): Promise<unknown>;
    static removeSchemaFromEndpoint(endpointId: string, schemaId: string): Promise<unknown>;
    static getLogs(endpointId: string, query?: any): Promise<unknown>;
    static getLogStats(endpointId: string): Promise<unknown>;
    static getTokenLogs(tokenId: string, query?: any): Promise<unknown>;
    static getRequests24h(): Promise<unknown>;
}
