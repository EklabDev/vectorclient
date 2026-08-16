import { db } from '../../config/database';
import { scrapeJobs, scrapeSources } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { CrawlerService } from './crawlerService';
import { ScrapeWeaviateService } from './scrapeWeaviateService';
import { GraphExtractService } from '../graphExtractService';

export async function runScrapeJob(sourceId: string, jobId: string): Promise<void> {
  const [source] = await db.select().from(scrapeSources).where(eq(scrapeSources.id, sourceId)).limit(1);
  if (!source) throw new Error('Scrape source not found');

  await db
    .update(scrapeJobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(scrapeJobs.id, jobId));
  await db
    .update(scrapeSources)
    .set({ status: 'running', lastError: null, updatedAt: new Date() })
    .where(eq(scrapeSources.id, sourceId));

  try {
    const domains = Array.isArray(source.allowedDomains)
      ? (source.allowedDomains as string[])
      : [];

    const pages = await CrawlerService.crawl({
      userId: source.userId,
      seedUrl: source.seedUrl,
      allowedDomains: domains,
      maxDepth: source.maxDepth,
      maxPages: source.maxPages,
    });

    const { className } = await ScrapeWeaviateService.replaceSourceChunks(
      source.id,
      source.name,
      pages
    );

    await GraphExtractService.extractAndUpsert(
      source.userId,
      pages.map((p) => ({ content: p.text.slice(0, 4000) })),
      { sourceId: source.id, sourceUrl: source.seedUrl }
    );

    await db
      .update(scrapeJobs)
      .set({
        status: 'completed',
        pagesCrawled: pages.length,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(scrapeJobs.id, jobId));

    await db
      .update(scrapeSources)
      .set({
        status: 'completed',
        weaviateCollectionId: className,
        lastCrawledAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(scrapeSources.id, sourceId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Crawl failed';
    await db
      .update(scrapeJobs)
      .set({ status: 'failed', error: message, updatedAt: new Date() })
      .where(eq(scrapeJobs.id, jobId));
    await db
      .update(scrapeSources)
      .set({ status: 'failed', lastError: message, updatedAt: new Date() })
      .where(eq(scrapeSources.id, sourceId));
    throw err;
  }
}
