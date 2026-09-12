import { Scrape } from '../../store/scrape';
import { CrawlerService } from './crawlerService';
import { ArcadeKnowledgeService } from '../arcadeKnowledgeService';

export async function runScrapeJob(sourceId: string, jobId: string): Promise<void> {
  const source = await Scrape.findById(sourceId);
  if (!source) throw new Error('Scrape source not found');

  await Scrape.updateJob(jobId, { status: 'running' });
  await Scrape.update(sourceId, { status: 'running', lastError: null });

  try {
    const domains = Array.isArray(source.allowedDomains) ? source.allowedDomains : [];
    const pages = await CrawlerService.crawl({
      userId: source.userId,
      seedUrl: source.seedUrl,
      allowedDomains: domains,
      maxDepth: source.maxDepth,
      maxPages: source.maxPages,
    });

    await ArcadeKnowledgeService.replaceSourceChunks(source.userId, source.id, source.name, pages);

    await Scrape.updateJob(jobId, {
      status: 'completed',
      pagesCrawled: pages.length,
      completedAt: new Date().toISOString(),
    });
    await Scrape.update(sourceId, {
      status: 'completed',
      lastCrawledAt: new Date().toISOString(),
      lastError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Crawl failed';
    await Scrape.updateJob(jobId, { status: 'failed', error: message });
    await Scrape.update(sourceId, { status: 'failed', lastError: message });
    throw err;
  }
}
