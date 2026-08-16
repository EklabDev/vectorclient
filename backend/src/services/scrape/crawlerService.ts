import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { RedisService } from '../redisService';

export type CrawledPage = {
  url: string;
  text: string;
  title: string;
};

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    u.hash = '';
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function domainOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

function extractText(html: string): { title: string; text: string; links: string[] } {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, nav, footer, header').remove();
  const title = $('title').first().text().trim() || $('h1').first().text().trim() || '';
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) links.push(href);
  });
  return { title, text, links };
}

async function fetchRobotsDisallow(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const body = await res.text();
    const disallows: string[] = [];
    let inStar = false;
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (/^user-agent:\s*\*/i.test(trimmed)) {
        inStar = true;
        continue;
      }
      if (/^user-agent:/i.test(trimmed)) {
        inStar = false;
        continue;
      }
      if (inStar) {
        const m = trimmed.match(/^disallow:\s*(.*)$/i);
        if (m && m[1].trim()) disallows.push(m[1].trim());
      }
    }
    return disallows;
  } catch {
    return [];
  }
}

function isDisallowed(pathname: string, disallows: string[]): boolean {
  return disallows.some((d) => d !== '' && pathname.startsWith(d));
}

export class CrawlerService {
  static async crawl(options: {
    userId: string;
    seedUrl: string;
    allowedDomains: string[];
    maxDepth: number;
    maxPages: number;
  }): Promise<CrawledPage[]> {
    const seed = normalizeUrl(options.seedUrl, options.seedUrl);
    if (!seed) throw new Error('Invalid seed URL');

    const allowed = new Set(
      (options.allowedDomains.length > 0
        ? options.allowedDomains
        : [domainOf(seed)]
      ).map((d) => d.replace(/^www\./, '').toLowerCase())
    );

    const origin = new URL(seed).origin;
    const disallows = await fetchRobotsDisallow(origin);

    const queue: Array<{ url: string; depth: number }> = [{ url: seed, depth: 0 }];
    const seen = new Set<string>();
    const pages: CrawledPage[] = [];

    while (queue.length > 0 && pages.length < options.maxPages) {
      const item = queue.shift()!;
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      const path = new URL(item.url).pathname;
      if (isDisallowed(path, disallows)) continue;
      if (!allowed.has(domainOf(item.url))) continue;

      const hashKey = `crawlhash:${createHash('sha256').update(item.url).digest('hex').slice(0, 24)}`;
      let html: string;
      try {
        const res = await fetch(item.url, {
          headers: { 'User-Agent': 'VectorClientBot/1.0' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) continue;
        html = await res.text();
      } catch {
        continue;
      }

      const contentHash = createHash('sha256').update(html).digest('hex');
      const prev = await RedisService.get(options.userId, hashKey);
      const { title, text, links } = extractText(html);
      if (!text || text.length < 40) continue;

      if (prev !== contentHash) {
        pages.push({ url: item.url, text: `# ${title}\n\n${text}`.slice(0, 100_000), title });
        await RedisService.set(options.userId, hashKey, contentHash, 60 * 60 * 24 * 7);
      } else {
        // Still count as crawled for link discovery, but skip re-index
        pages.push({ url: item.url, text: `# ${title}\n\n${text}`.slice(0, 100_000), title });
      }

      if (item.depth >= options.maxDepth) continue;
      for (const href of links) {
        const next = normalizeUrl(href, item.url);
        if (!next || seen.has(next)) continue;
        if (!allowed.has(domainOf(next))) continue;
        queue.push({ url: next, depth: item.depth + 1 });
      }
    }

    return pages;
  }
}
