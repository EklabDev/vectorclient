import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import { config } from 'dotenv';
import { authRoutes } from './routes/auth';
import { tokenRoutes } from './routes/tokens';
import { endpointRoutes } from './routes/endpoints';
import { schemaRoutes } from './routes/schemas';
import { logRoutes } from './routes/logs';
import { dynamicRoutes } from './routes/dynamic';

config();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register plugins
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'change-me',
  sign: { expiresIn: '24h' },
});

app.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

// Health check
app.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// Routes
app.register(authRoutes, { prefix: '/auth' });
app.register(tokenRoutes, { prefix: '/api/tokens' });
app.register(endpointRoutes, { prefix: '/api/endpoints' });
app.register(schemaRoutes, { prefix: '/api/schemas' });
app.register(logRoutes, { prefix: '/api/logs' });
app.register(dynamicRoutes, { prefix: '/api/v1/endpoints' });

const start = async () => {
  try {
    await app.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${process.env.PORT || 3001}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
