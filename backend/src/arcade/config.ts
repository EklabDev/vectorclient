export const GATEWAY_DB = process.env.ARCADEDB_GATEWAY_DB || 'gateway';
export const EMBEDDING_DIMS = 1536;
export const DEFAULT_TOPIC_MIN_SIMILARITY = 0.4;
export const DEFAULT_OFF_TOPIC_REPLY =
  'I can only help with questions about this organization and its programs. Please ask about schedules, offerings, enrollment, or contact information.';

export function knowledgeDbName(userId: string): string {
  return `kb${userId.replace(/-/g, '')}`;
}

export function arcadeUrl(): string {
  return (process.env.ARCADEDB_URL || 'http://localhost:2480').replace(/\/$/, '');
}

export function arcadeUser(): string {
  return process.env.ARCADEDB_USER || 'root';
}

export function arcadePassword(): string {
  return process.env.ARCADEDB_PASSWORD || 'arcadedb';
}
