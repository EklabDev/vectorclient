import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { db } from '../config/database';
import { scrapeSources, scrapeJobs, schemas } from '../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { enqueueScrapeJob } from '../services/queue/scrapeQueue';
import { runScrapeJob } from '../services/scrape/scrapeRunner';

const createBody = z.object({
  name: z.string().min(1).max(255),
  seedUrl: z.string().url(),
  schemaId: z.string().uuid().nullable().optional(),
  allowedDomains: z.array(z.string()).optional().default([]),
  maxDepth: z.number().int().min(0).max(5).optional().default(2),
  maxPages: z.number().int().min(1).max(200).optional().default(50),
  isActive: z.boolean().optional().default(true),
});

const updateBody = z.object({
  name: z.string().min(1).max(255).optional(),
  seedUrl: z.string().url().optional(),
  schemaId: z.string().uuid().nullable().optional(),
  allowedDomains: z.array(z.string()).optional(),
  maxDepth: z.number().int().min(0).max(5).optional(),
  maxPages: z.number().int().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export async function scrapeSourceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', async (request) => {
    const { userId } = request.user as { userId: string };
    return db
      .select()
      .from(scrapeSources)
      .where(eq(scrapeSources.userId, userId))
      .orderBy(desc(scrapeSources.createdAt));
  });

  app.post('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = createBody.parse(request.body);

      if (body.schemaId) {
        const [schema] = await db
          .select()
          .from(schemas)
          .where(and(eq(schemas.id, body.schemaId), eq(schemas.userId, userId)))
          .limit(1);
        if (!schema) {
          reply.code(400).send({ message: 'schemaId not found for this user' });
          return;
        }
      }

      const [row] = await db
        .insert(scrapeSources)
        .values({
          id: uuidv4(),
          userId,
          name: body.name,
          seedUrl: body.seedUrl,
          schemaId: body.schemaId ?? null,
          allowedDomains: body.allowedDomains,
          maxDepth: body.maxDepth,
          maxPages: body.maxPages,
          isActive: body.isActive,
          status: 'idle',
        })
        .returning();
      reply.code(201);
      return row;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.patch('/:id', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = updateBody.parse(request.body);

      const [existing] = await db
        .select()
        .from(scrapeSources)
        .where(and(eq(scrapeSources.id, id), eq(scrapeSources.userId, userId)))
        .limit(1);
      if (!existing) {
        reply.code(404).send({ message: 'Scrape source not found' });
        return;
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.seedUrl !== undefined) updateData.seedUrl = body.seedUrl;
      if (body.schemaId !== undefined) updateData.schemaId = body.schemaId;
      if (body.allowedDomains !== undefined) updateData.allowedDomains = body.allowedDomains;
      if (body.maxDepth !== undefined) updateData.maxDepth = body.maxDepth;
      if (body.maxPages !== undefined) updateData.maxPages = body.maxPages;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      const [updated] = await db
        .update(scrapeSources)
        .set(updateData)
        .where(eq(scrapeSources.id, id))
        .returning();
      return updated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  app.delete('/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const [existing] = await db
      .select()
      .from(scrapeSources)
      .where(and(eq(scrapeSources.id, id), eq(scrapeSources.userId, userId)))
      .limit(1);
    if (!existing) {
      reply.code(404).send({ message: 'Scrape source not found' });
      return;
    }
    await db.delete(scrapeSources).where(eq(scrapeSources.id, id));
    return { ok: true };
  });

  app.get('/:id/jobs', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const [existing] = await db
      .select()
      .from(scrapeSources)
      .where(and(eq(scrapeSources.id, id), eq(scrapeSources.userId, userId)))
      .limit(1);
    if (!existing) {
      reply.code(404).send({ message: 'Scrape source not found' });
      return;
    }
    return db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.sourceId, id))
      .orderBy(desc(scrapeJobs.createdAt))
      .limit(50);
  });

  app.post('/:id/crawl', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const [existing] = await db
      .select()
      .from(scrapeSources)
      .where(and(eq(scrapeSources.id, id), eq(scrapeSources.userId, userId)))
      .limit(1);
    if (!existing) {
      reply.code(404).send({ message: 'Scrape source not found' });
      return;
    }
    if (existing.status === 'running') {
      reply.code(409).send({ message: 'Crawl already running' });
      return;
    }

    const jobId = uuidv4();
    const [job] = await db
      .insert(scrapeJobs)
      .values({
        id: jobId,
        sourceId: id,
        status: 'queued',
      })
      .returning();

    const queued = await enqueueScrapeJob(id, jobId);
    if (!queued) {
      setImmediate(() => {
        runScrapeJob(id, jobId).catch((err) => console.error('Inline scrape job failed:', err));
      });
    }

    reply.code(202);
    return { job, queued };
  });
}
