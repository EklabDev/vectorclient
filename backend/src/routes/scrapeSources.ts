import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { Schemas } from '../store/schemas';
import { Scrape } from '../store/scrape';
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

const updateBody = createBody.partial();

export async function scrapeSourceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  app.get('/', async (request) => {
    const { userId } = request.user as { userId: string };
    return Scrape.listByUser(userId);
  });

  app.post('/', async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = createBody.parse(request.body);
      if (body.schemaId) {
        const schema = await Schemas.findByIdAndUser(body.schemaId, userId);
        if (!schema) {
          reply.code(400).send({ message: 'schemaId not found for this user' });
          return;
        }
      }
      const row = await Scrape.create({
        userId,
        name: body.name,
        seedUrl: body.seedUrl,
        schemaId: body.schemaId ?? null,
        allowedDomains: body.allowedDomains,
        maxDepth: body.maxDepth,
        maxPages: body.maxPages,
        isActive: body.isActive,
      });
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
      const existing = await Scrape.findByIdAndUser(id, userId);
      if (!existing) {
        reply.code(404).send({ message: 'Scrape source not found' });
        return;
      }
      return Scrape.update(id, body);
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
    const existing = await Scrape.findByIdAndUser(id, userId);
    if (!existing) {
      reply.code(404).send({ message: 'Scrape source not found' });
      return;
    }
    await Scrape.remove(id);
    return { ok: true };
  });

  app.get('/:id/jobs', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const existing = await Scrape.findByIdAndUser(id, userId);
    if (!existing) {
      reply.code(404).send({ message: 'Scrape source not found' });
      return;
    }
    return Scrape.jobsForSource(id);
  });

  app.post('/:id/crawl', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const existing = await Scrape.findByIdAndUser(id, userId);
    if (!existing) {
      reply.code(404).send({ message: 'Scrape source not found' });
      return;
    }
    if (existing.status === 'running') {
      reply.code(409).send({ message: 'Crawl already running' });
      return;
    }
    const job = await Scrape.createJob(id);
    const queued = await enqueueScrapeJob(id, job.id);
    if (!queued) {
      setImmediate(() => {
        runScrapeJob(id, job.id).catch((err) => console.error('Inline scrape job failed:', err));
      });
    }
    reply.code(202);
    return { job, queued };
  });
}
