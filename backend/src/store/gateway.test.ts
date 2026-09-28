import { describe, it, expect, beforeEach } from 'vitest';
import { setArcadeFetch } from '../arcade/client';
import { Users } from './users';
import { Tokens } from './tokens';
import { Endpoints } from './endpoints';
import { buildSet, buildWhere } from '../arcade/sql';

describe('sql where builder', () => {
  it('builds IN and range clauses', () => {
    const { sql, params } = buildWhere({
      userId: 'u1',
      id: { in: ['a', 'b'] },
      createdAt: { gte: '2020-01-01', lte: '2020-12-31' },
    });
    expect(sql).toContain('`userId` =');
    expect(sql).toContain('IN');
    expect(sql).toContain('>=');
    expect(sql).toContain('<=');
    expect(Object.keys(params).length).toBeGreaterThan(3);
  });

  it('binds keyword field names with safe parameters', () => {
    const { sql, params } = buildSet({ name: 'eklab', maxDepth: 2 });
    expect(sql).toContain('`maxDepth` = :p1');
    expect(sql).not.toContain(':maxDepth');
    expect(params.p1).toBe(2);
  });
});

describe('gateway store (fake Arcade HTTP)', () => {
  const docs: Record<string, Record<string, unknown>[]> = {};

  beforeEach(() => {
    for (const k of Object.keys(docs)) delete docs[k];
    setArcadeFetch(async (_url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const command: string = body.command || '';
      const params = (body.params || {}) as Record<string, unknown>;
      const typeMatch =
        command.match(/INTO (\w+)/) || command.match(/FROM (\w+)/) || command.match(/UPDATE (\w+)/);
      const type = typeMatch?.[1] || 'Unknown';
      docs[type] ||= [];
      if (command.startsWith('INSERT')) {
        const doc: Record<string, unknown> = {};
        const assignments = /`([^`]+)`\s*=\s*:(\w+)/g;
        for (const match of command.matchAll(assignments)) {
          doc[match[1]] = params[match[2]];
        }
        docs[type].push(doc);
        return new Response(JSON.stringify({ result: [] }), { status: 200 });
      }
      if (command.startsWith('SELECT')) {
        let rows = docs[type];
        if (params.w0 != null) {
          rows = rows.filter((r) => Object.values(r).some((v) => v === params.w0));
        }
        return new Response(JSON.stringify({ result: rows }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    });
  });

  it('creates and finds a user by username', async () => {
    const user = await Users.create({
      username: 'ada',
      password: 'secret',
      email: 'ada@example.com',
      displayName: 'Ada',
    });
    expect(user.username).toBe('ada');
    const found = await Users.findByUsername('ada');
    expect(found?.email).toBe('ada@example.com');
  });

  it('creates an API token for a user', async () => {
    const user = await Users.create({
      username: 'tok',
      password: 'secret',
      email: 'tok@example.com',
      displayName: 'Tok',
    });
    const token = await Tokens.create({
      userId: user.id,
      tokenName: 'prod',
      tokenValue: 'hashed',
      tokenPrefix: 'sk_abc',
      expiresAt: null,
    });
    expect(token.tokenPrefix).toBe('sk_abc');
    const found = await Tokens.findById(token.id);
    expect(found?.userId).toBe(user.id);
  });

  it('creates an endpoint with a topic filter', async () => {
    const user = await Users.create({
      username: 'ep',
      password: 'secret',
      email: 'ep@example.com',
      displayName: 'Ep',
    });
    const endpoint = await Endpoints.create({
      userId: user.id,
      routeName: 'agent',
      route: 'https://example.com/hook',
      rateLimit: 100,
      rateLimitWindowMs: 60000,
      allowedOrigins: [],
      description: null,
      isActive: true,
      topicFilter: { enabled: true, minSimilarity: 0.4, offTopicReply: 'Stay on topic.' },
    });
    expect(endpoint.routeName).toBe('agent');
    const found = await Endpoints.findById(endpoint.id);
    expect(found?.userId).toBe(user.id);
  });
});
