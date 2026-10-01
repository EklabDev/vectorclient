import * as cheerio from 'cheerio';

type SpaPage = {
  url: string;
  text: string;
  title: string;
};

const MAX_BUNDLE_CHARS = 2_000_000;
const MAX_JSON_CHARS = 1_000_000;
const MIN_TEXT = 40;

const SKIP_KEYS = new Set([
  'id',
  '_id',
  '__v',
  'createdat',
  'updatedat',
  'createdby',
  'updatedby',
  'displayorder',
  'isactive',
  'isfeatured',
  'slug',
]);

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

export function isBlockedApiHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host === '0.0.0.0') return true;
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function moduleScriptUrls(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const origin = new URL(pageUrl).origin;
  $('script[src]').each((_, el) => {
    const type = ($(el).attr('type') || '').toLowerCase();
    if (type !== 'module') return;
    const src = $(el).attr('src');
    if (!src) return;
    const abs = normalizeUrl(src, pageUrl);
    if (!abs || new URL(abs).origin !== origin) return;
    urls.push(abs);
  });
  return [...new Set(urls)];
}

export function extractPublicApiUrls(js: string): string[] {
  const bases = new Set<string>();
  for (const match of js.matchAll(/https:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[a-zA-Z0-9._~-]*)*\/api\b/g)) {
    bases.add(match[0].replace(/\/$/, ''));
  }
  const paths = new Set<string>();
  for (const match of js.matchAll(/["'`](\/public\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)["'`]/g)) {
    paths.add(match[1]);
  }
  const urls = new Set<string>();
  for (const match of js.matchAll(/https:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/api\/public\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/g)) {
    urls.add(match[0]);
  }
  for (const base of bases) {
    for (const path of paths) urls.add(`${base}${path}`);
  }
  return [...urls].filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && !isBlockedApiHost(parsed.hostname);
    } catch {
      return false;
    }
  });
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function skipString(key: string, value: string): boolean {
  const name = key.toLowerCase();
  if (SKIP_KEYS.has(name)) return true;
  if (/image|logo|thumbnail|icon|avatar/.test(name)) return true;
  if (/^https?:\/\//i.test(value) && /\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(value)) return true;
  if (/^[a-f0-9]{24}$/i.test(value)) return true;
  if (/^\d{4}-\d{2}-\d{2}t/i.test(value)) return true;
  return false;
}

function collectStrings(value: unknown, key: string, out: string[]): void {
  if (typeof value === 'string') {
    const text = stripHtml(value);
    if (text.length < 2 || skipString(key, text)) return;
    out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, key, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, child] of Object.entries(value)) {
    if (SKIP_KEYS.has(childKey.toLowerCase())) continue;
    collectStrings(child, childKey, out);
  }
}

function documentsFromJson(payload: unknown): unknown[] {
  const asDocs = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
    if (value && typeof value === 'object') return [value];
    return [];
  };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return asDocs(payload);
  if ('data' in payload) return asDocs((payload as { data: unknown }).data);
  return asDocs(payload);
}

function titleOf(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const record = doc as Record<string, unknown>;
  for (const key of ['name', 'title', 'homepageTitle', 'siteName', 'aboutUsTitle']) {
    const value = record[key];
    if (typeof value === 'string' && stripHtml(value)) return stripHtml(value).slice(0, 200);
  }
  return '';
}

function pageUrlFor(apiUrl: string, doc: unknown, index: number): string {
  if (doc && typeof doc === 'object') {
    const slug = (doc as Record<string, unknown>).slug;
    if (typeof slug === 'string' && /^[A-Za-z0-9._-]+$/.test(slug)) {
      return `${apiUrl.replace(/\/$/, '')}/${encodeURIComponent(slug)}`;
    }
  }
  return index === 0 ? apiUrl : `${apiUrl}#${index}`;
}

function pagesFromPayload(apiUrl: string, payload: unknown): SpaPage[] {
  const pages: SpaPage[] = [];
  for (const [index, doc] of documentsFromJson(payload).entries()) {
    const parts: string[] = [];
    collectStrings(doc, '', parts);
    const unique = [...new Set(parts)];
    const text = unique.join('\n\n').slice(0, 100_000);
    if (text.length < MIN_TEXT) continue;
    const title = titleOf(doc);
    pages.push({
      url: pageUrlFor(apiUrl, doc, index),
      title,
      text: title ? `# ${title}\n\n${text}` : text,
    });
  }
  return pages;
}

async function readCappedText(res: Response, maxChars: number): Promise<string | null> {
  const declared = Number(res.headers.get('content-length') || '0');
  if (declared > maxChars) return null;
  const text = await res.text();
  if (text.length > maxChars) return null;
  return text;
}

export async function pagesFromSpaShell(html: string, pageUrl: string): Promise<SpaPage[]> {
  const scripts = moduleScriptUrls(html, pageUrl);
  const apiUrls = new Set<string>();
  for (const scriptUrl of scripts) {
    try {
      const res = await fetch(scriptUrl, {
        headers: { 'User-Agent': 'VectorClientBot/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const js = await readCappedText(res, MAX_BUNDLE_CHARS);
      if (!js) continue;
      for (const url of extractPublicApiUrls(js)) apiUrls.add(url);
    } catch {
      // Skip a bundle that fails to download.
    }
  }

  const pages: SpaPage[] = [];
  const seen = new Set<string>();
  for (const apiUrl of apiUrls) {
    try {
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'VectorClientBot/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) continue;
      const body = await readCappedText(res, MAX_JSON_CHARS);
      if (!body) continue;
      const parsed = JSON.parse(body) as unknown;
      for (const page of pagesFromPayload(apiUrl, parsed)) {
        if (seen.has(page.url)) continue;
        seen.add(page.url);
        pages.push(page);
      }
    } catch {
      // Skip an API that is not JSON or does not respond.
    }
  }
  return pages;
}
