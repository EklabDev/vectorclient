export type TopicFilter = {
  enabled: boolean;
  minSimilarity: number;
  offTopicReply: string;
};

export type UserDoc = {
  id: string;
  username: string;
  password: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

export type ApiTokenDoc = {
  id: string;
  userId: string;
  tokenName: string;
  tokenPrefix: string;
  tokenValue: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export type EndpointDoc = {
  id: string;
  userId: string;
  routeName: string;
  route: string;
  rateLimit: number;
  rateLimitWindowMs: number;
  allowedOrigins: string[];
  description: string | null;
  isActive: boolean;
  topicFilterJson: string;
  createdAt: string;
  updatedAt: string;
};

export type SchemaDoc = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  content: string;
  systemPrompt: string | null;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CallLogDoc = {
  id: string;
  endpointId: string;
  apiTokenId: string | null;
  method: string;
  path: string;
  status: number;
  requestBody: string | null;
  responseBody: string | null;
  responseTime: number;
  ipAddress: string | null;
  userAgent: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type ScrapeSourceDoc = {
  id: string;
  userId: string;
  schemaId: string | null;
  name: string;
  seedUrl: string;
  allowedDomains: string[];
  maxDepth: number;
  maxPages: number;
  isActive: boolean;
  status: string;
  lastCrawledAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScrapeJobDoc = {
  id: string;
  sourceId: string;
  status: string;
  pagesCrawled: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type CrmWebhookDoc = {
  id: string;
  endpointId: string;
  userId: string;
  name: string;
  url: string;
  method: string;
  headersJson: string;
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CrmPayloadSchemaDoc = {
  id: string;
  endpointId: string;
  userId: string;
  jsonSchema: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowStep = {
  field: string;
  prompt: string;
  required: boolean;
};

export type AgentWorkflowDoc = {
  id: string;
  endpointId: string;
  userId: string;
  webhookId: string | null;
  name: string;
  triggerJson: string;
  stepsJson: string;
  confirmMessage: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChunk = {
  id: string;
  content?: string;
  originalReference?: string;
  schemaId?: string;
  schemaName?: string;
  version?: number;
  chunkIndex?: number;
  category?: string;
  subcategory?: string;
  sourceId?: string;
  sourceType?: string;
  score?: number;
};

export const DEFAULT_TOPIC_FILTER: TopicFilter = {
  enabled: true,
  minSimilarity: 0.4,
  offTopicReply:
    'I can only help with questions about this organization and its programs. Please ask about schedules, offerings, enrollment, or contact information.',
};
