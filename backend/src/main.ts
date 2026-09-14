import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import { config } from 'dotenv';
import { authRoutes } from './routes/auth';
import { tokenRoutes } from './routes/tokens';
import { endpointRoutes } from './routes/endpoints';
import { schemaRoutes } from './routes/schemas';
import { schemaKnowledgeRoutes } from './routes/schemaKnowledge';
import { logRoutes } from './routes/logs';
import { dynamicRoutes } from './routes/dynamic';
import { agentRoutes } from './routes/agents';
import { scrapeSourceRoutes } from './routes/scrapeSources';
import { crmRoutes } from './routes/crm';
import { studioRoutes } from './routes/studio';
import { startScrapeWorker } from './services/scrape/scrapeWorker';
import { bootstrapAll } from './arcade/bootstrap';

config();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'change-me',
  sign: { expiresIn: '24h' },
});

app.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

app.get('/health', async () => ({ status: 'ok' }));

app.register(authRoutes, { prefix: '/auth' });
app.register(tokenRoutes, { prefix: '/api/tokens' });
app.register(endpointRoutes, { prefix: '/api/endpoints' });
app.register(crmRoutes, { prefix: '/api/endpoints' });
app.register(schemaKnowledgeRoutes, { prefix: '/api/schemas' });
app.register(schemaRoutes, { prefix: '/api/schemas' });
app.register(logRoutes, { prefix: '/api/logs' });
app.register(scrapeSourceRoutes, { prefix: '/api/scrape-sources' });
app.register(studioRoutes, { prefix: '/api/studio' });
app.register(dynamicRoutes, { prefix: '/api/v1/endpoints' });
app.register(agentRoutes, { prefix: '/api/v1/agents' });
app.register(agentRoutes, { prefix: '/api/v1/agent' });

const start = async () => {
  try {
    await bootstrapAll();
    startScrapeWorker();
    await app.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${process.env.PORT || 3001}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
