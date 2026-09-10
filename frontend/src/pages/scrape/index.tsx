import { useEffect, useState } from 'react';
import { ApiClient } from '../../services/api';

interface ScrapeSource {
  id: string;
  name: string;
  seedUrl: string;
  schemaId: string | null;
  allowedDomains: string[];
  maxDepth: number;
  maxPages: number;
  isActive: boolean;
  status: string;
  weaviateCollectionId: string | null;
  lastCrawledAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface SchemaOption {
  id: string;
  name: string;
}

export function ScrapeSourcesPage() {
  const [sources, setSources] = useState<ScrapeSource[]>([]);
  const [schemas, setSchemas] = useState<SchemaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    seedUrl: '',
    schemaId: '',
    allowedDomains: '',
    maxDepth: 2,
    maxPages: 50,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [src, sch] = await Promise.all([
        ApiClient.getScrapeSources() as Promise<ScrapeSource[]>,
        ApiClient.getSchemas() as Promise<SchemaOption[]>,
      ]);
      setSources(Array.isArray(src) ? src : []);
      setSchemas(Array.isArray(sch) ? sch : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const domains = form.allowedDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      await ApiClient.createScrapeSource({
        name: form.name,
        seedUrl: form.seedUrl,
        schemaId: form.schemaId || null,
        allowedDomains: domains,
        maxDepth: form.maxDepth,
        maxPages: form.maxPages,
      });
      setShowCreate(false);
      setForm({ name: '', seedUrl: '', schemaId: '', allowedDomains: '', maxDepth: 2, maxPages: 50 });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCrawl = async (id: string) => {
    try {
      setBusyId(id);
      setError('');
      await ApiClient.triggerScrapeCrawl(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scrape source?')) return;
    try {
      setBusyId(id);
      await ApiClient.deleteScrapeSource(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#fff' }}>Scrape Sources</h1>
          <p style={{ color: '#a1a1aa', margin: '8px 0 0' }}>
            Crawl client websites into Weaviate + Neo4j for the native agent.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Add Source
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: '#7f1d1d', color: '#fca5a5', borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {showCreate && (
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
          <form
            onSubmit={handleCreate}
            style={{
              backgroundColor: '#27272a',
              padding: 24,
              borderRadius: 8,
              width: '90%',
              maxWidth: 520,
              border: '1px solid #3f3f46',
            }}
          >
            <h2 style={{ marginTop: 0, color: '#fff' }}>New scrape source</h2>
            {(['name', 'seedUrl', 'allowedDomains'] as const).map((field) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: 6 }}>
                  {field === 'allowedDomains' ? 'Allowed domains (comma-separated)' : field === 'seedUrl' ? 'Seed URL' : 'Name'}
                </label>
                <input
                  required={field !== 'allowedDomains'}
                  type={field === 'seedUrl' ? 'url' : 'text'}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 6,
                    color: '#fff',
                  }}
                  placeholder={field === 'seedUrl' ? 'https://example.com' : ''}
                />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: 6 }}>Link schema (optional)</label>
              <select
                value={form.schemaId}
                onChange={(e) => setForm({ ...form, schemaId: e.target.value })}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                }}
              >
                <option value="">None</option>
                {schemas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: 6 }}>Max depth</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={form.maxDepth}
                  onChange={(e) => setForm({ ...form, maxDepth: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: 8,
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 6,
                    color: '#fff',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: 6 }}>Max pages</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={form.maxPages}
                  onChange={(e) => setForm({ ...form, maxPages: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: 8,
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 6,
                    color: '#fff',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 12px', background: '#3f3f46', color: '#fff', border: 'none', borderRadius: 6 }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '8px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6 }}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#a1a1aa' }}>Loading…</p>
      ) : sources.length === 0 ? (
        <p style={{ color: '#a1a1aa' }}>No scrape sources yet.</p>
      ) : (
        <div style={{ backgroundColor: '#27272a', borderRadius: 8, border: '1px solid #3f3f46', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #3f3f46' }}>
                {['Name', 'Seed URL', 'Status', 'Last crawl', 'Collection', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: 12, textAlign: 'left', color: '#fff' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #3f3f46' }}>
                  <td style={{ padding: 12, color: '#fff' }}>{s.name}</td>
                  <td style={{ padding: 12, color: '#a1a1aa', fontFamily: 'monospace', fontSize: 12 }}>{s.seedUrl}</td>
                  <td style={{ padding: 12, color: '#a1a1aa' }}>{s.status}{s.lastError ? ` — ${s.lastError}` : ''}</td>
                  <td style={{ padding: 12, color: '#a1a1aa' }}>
                    {s.lastCrawledAt ? new Date(s.lastCrawledAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: 12, color: '#a1a1aa', fontFamily: 'monospace', fontSize: 12 }}>
                    {s.weaviateCollectionId || '—'}
                  </td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => handleCrawl(s.id)}
                      disabled={busyId === s.id || s.status === 'running'}
                      style={{
                        marginRight: 8,
                        padding: '6px 10px',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      {busyId === s.id ? 'Starting…' : 'Crawl'}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={busyId === s.id}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#7f1d1d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
