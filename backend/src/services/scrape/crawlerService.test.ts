import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrawlerService } from './crawlerService';

vi.mock('../redisService', () => ({
  RedisService: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    isEnabled: () => false,
  },
}));

const shell = `<!doctype html>
<html><head><title>Sparkle</title>
<script type="module" src="/assets/app.js"></script>
</head><body><div id="root"></div></body></html>`;

const bundle = `
const api = "https://api.example.com/api";
fetch(api + "/public/programs");
fetch("https://127.0.0.1/api/public/secret");
const detail = "/public/instructors/";
`;

const programs = {
  data: [
    {
      name: 'Design Studio',
      slug: 'design-studio',
      description: '<p>Create your custom products in the design studio with mentors every week.</p>',
      thumbnailImage: 'https://cdn.example.com/thumb.png',
      _id: '6959bf33f4bc33f3e69a4004',
    },
  ],
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('CrawlerService SPA shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('indexes JSON named in the bundle and skips private hosts', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
      }
      if (url === 'https://spa.example/') {
        return new Response(shell, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      if (url === 'https://spa.example/assets/app.js') {
        return new Response(bundle, { status: 200, headers: { 'content-type': 'application/javascript' } });
      }
      if (url === 'https://api.example.com/api/public/programs') return jsonResponse(programs);
      if (url.includes('127.0.0.1')) return jsonResponse({ data: { name: 'should not load' } });
      return new Response('missing', { status: 404 });
    });

    const pages = await CrawlerService.crawl({
      userId: 'user-1',
      seedUrl: 'https://spa.example/',
      allowedDomains: [],
      maxDepth: 1,
      maxPages: 10,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe('https://api.example.com/api/public/programs/design-studio');
    expect(pages[0].title).toBe('Design Studio');
    expect(pages[0].text).toContain('Create your custom products');
    expect(pages[0].text).not.toContain('<p>');
    expect(pages[0].text).not.toContain('thumb.png');
    expect(calls.some((url) => url.includes('127.0.0.1'))).toBe(false);
    expect(calls.some((url) => url.includes('r.jina.ai'))).toBe(false);
  });

  it('does not fetch the bundle when the HTML already has body text', async () => {
    const calls: string[] = [];
    const html = `<!doctype html><html><head><title>EKLab</title>
      <script type="module" src="/assets/app.js"></script>
      </head><body><main><h1>Welcome to EKLab</h1><p>${'Software development and 3D printing for education. '.repeat(3)}</p></main></body></html>`;
    vi.stubGlobal('fetch', async (input: RequestInfo) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/robots.txt')) {
        return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
      }
      if (url === 'https://eklab.example/') {
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return new Response('no', { status: 500 });
    });

    const pages = await CrawlerService.crawl({
      userId: 'user-1',
      seedUrl: 'https://eklab.example/',
      allowedDomains: [],
      maxDepth: 0,
      maxPages: 5,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].text).toContain('Welcome to EKLab');
    expect(calls.some((url) => url.endsWith('/assets/app.js'))).toBe(false);
  });
});
