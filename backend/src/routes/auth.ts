import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/authService';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  email: z.string().email(),
  displayName: z.string().min(2),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      const result = await AuthService.register(
        body.username,
        body.password,
        body.email,
        body.displayName
      );
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      console.log(body.username);
      console.log(body.password);
      const result = await AuthService.login(body.username, body.password);
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(401).send({ message: (error as Error).message });
    }
  });
}
