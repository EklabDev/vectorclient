export type KnowledgeCollection = {
  schemaId: string;
  schemaName: string;
  className: string;
  systemPrompt: string | null;
  sourceType: 'schema' | 'scrape';
};

export type AgentToolContext = {
  userId: string;
  endpointId: string;
  conversationId: string;
  collections: KnowledgeCollection[];
};

export type AgentRunInput = {
  userId: string;
  endpointId: string;
  message: string;
  conversationId?: string;
  extraContext?: Record<string, unknown>;
  collections: KnowledgeCollection[];
};

export type AgentRunResult = {
  reply: string;
  conversationId: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; ok: boolean }>;
};

export type AgentToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, ctx: AgentToolContext) => Promise<unknown>;
};
