import { useEffect, useRef, useState } from 'react';
import { ApiClient } from '../../services/api';

interface Chunk {
  id: string;
  content?: string;
  originalReference?: string;
  category?: string;
  subcategory?: string;
}

interface PageGroup {
  url: string;
  chunks: Chunk[];
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function groupPages(objects: Chunk[]): PageGroup[] {
  const pages = new Map<string, PageGroup>();
  for (const chunk of objects) {
    const ref = chunk.originalReference?.trim() || '';
    const url = isUrl(ref) ? ref : 'Scraped text';
    const page = pages.get(url) || { url, chunks: [] };
    page.chunks.push(chunk);
    pages.set(url, page);
  }
  return [...pages.values()];
}

export function ScrapedContent({
  sourceId,
  sourceName,
  running,
  onClose,
}: {
  sourceId: string;
  sourceName: string;
  running: boolean;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<PageGroup[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const chunkCount = pages.reduce((sum, page) => sum + page.chunks.length, 0);
  const pageCount = pages.filter((page) => page.url.startsWith('http')).length;

  const load = async () => {
    try {
      setError('');
      const res = await ApiClient.getScrapeChunks(sourceId);
      const grouped = groupPages(res.objects || []);
      setPages(grouped);
      setTruncated(Boolean(res.truncated));
      setOpenUrl((current) => current ?? grouped[0]?.url ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [sourceId]);

  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) void load();
    wasRunning.current = running;
  }, [running]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: 24,
          borderRadius: 8,
          width: '90%',
          maxWidth: 860,
          maxHeight: '85vh',
          overflow: 'auto',
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: '#111827' }}>{sourceName}</h2>
            <p style={{ margin: '6px 0 0', color: '#111827' }}>
              {loading
                ? 'Loading scraped pages…'
                : pageCount > 0
                  ? `${pageCount} page${pageCount === 1 ? '' : 's'} · ${chunkCount} chunks`
                  : `${chunkCount} chunk${chunkCount === 1 ? '' : 's'}`}
              {running ? ' · crawl still running' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 12px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 6 }}
          >
            Close
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 16 }}>
            {error}
          </div>
        )}
        {truncated && (
          <p style={{ color: '#fbbf24', marginTop: 0 }}>Showing the first 500 chunks from this source.</p>
        )}
        {!loading && pages.length === 0 && <p style={{ color: '#111827' }}>Nothing scraped yet.</p>}

        {pages.map((page) => (
          <div key={page.url} style={{ borderTop: '1px solid #e5e7eb', padding: '12px 0' }}>
            <button
              type="button"
              onClick={() => setOpenUrl((current) => (current === page.url ? null : page.url))}
              style={{
                background: 'none',
                border: 'none',
                color: '#0f766e',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'monospace',
                fontSize: 13,
              }}
            >
              {page.url}
            </button>
            <div style={{ color: '#111827', fontSize: 12, marginTop: 4 }}>{page.chunks.length} chunks</div>
            {openUrl === page.url &&
              page.chunks.map((chunk) => (
                <div key={chunk.id} style={{ marginTop: 10, color: '#e4e4e7', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {(chunk.category || chunk.subcategory) && (
                    <div style={{ color: '#111827', fontSize: 12, marginBottom: 4 }}>
                      {[chunk.category, chunk.subcategory].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {chunk.content || chunk.originalReference}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
