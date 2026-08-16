import { Queue } from 'bullmq';
import { RedisService } from '../redisService';

export const SCRAPE_QUEUE_NAME = 'scrape-jobs';

let scrapeQueue: Queue | null = null;

export function getScrapeQueue(): Queue | null {
  if (scrapeQueue) return scrapeQueue;
  const connection = RedisService.getRawClient();
  if (!connection) return null;
  scrapeQueue = new Queue(SCRAPE_QUEUE_NAME, {
    connection: connection.duplicate(),
  });
  return scrapeQueue;
}

export async function enqueueScrapeJob(sourceId: string, jobId: string): Promise<boolean> {
  const queue = getScrapeQueue();
  if (!queue) return false;
  await queue.add(
    'crawl',
    { sourceId, jobId },
    {
      jobId,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 2,
    }
  );
  return true;
}
