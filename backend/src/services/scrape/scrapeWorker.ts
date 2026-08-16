import { Worker } from 'bullmq';
import { RedisService } from '../redisService';
import { SCRAPE_QUEUE_NAME } from '../queue/scrapeQueue';
import { runScrapeJob } from './scrapeRunner';

let worker: Worker | null = null;

export function startScrapeWorker(): Worker | null {
  if (worker) return worker;
  const connection = RedisService.getRawClient();
  if (!connection) {
    console.warn('Scrape worker not started: REDIS_URL not configured');
    return null;
  }

  worker = new Worker(
    SCRAPE_QUEUE_NAME,
    async (job) => {
      const { sourceId, jobId } = job.data as { sourceId: string; jobId: string };
      await runScrapeJob(sourceId, jobId);
    },
    {
      connection: connection.duplicate(),
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Scrape job ${job?.id} failed:`, err.message);
  });

  console.log('Scrape worker started');
  return worker;
}
