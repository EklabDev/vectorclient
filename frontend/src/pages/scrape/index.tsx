import { useEffect, useState } from 'react';
import { ApiClient } from '../../services/api';
import { ScrapedContent } from './ScrapedContent';

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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    seedUrl: '',
    schemaId: '',
    allowedDomains: '',
    maxDepth: 2,
    maxPages: 50,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const crawling = sources.some((s) => s.status === 'running');
  useEffect(() => {
    if (!crawling) return;
    const timer = setInterval(() => {
      void load(true);
    }, 2000);
    return () => clearInterval(timer);
  }, [crawling]);

  const emptyForm = { name: '', seedUrl: '', schemaId: '', allowedDomains: '', maxDepth: 2, maxPages: 50 };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (source: ScrapeSource) => {
    setEditingId(source.id);
    setForm({
      name: source.name,
      seedUrl: source.seedUrl,
      schemaId: source.schemaId || '',
      allowedDomains: source.allowedDomains.join(', '),
      maxDepth: source.maxDepth,
      maxPages: source.maxPages,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const domains = form.allowedDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      const payload = {
        name: form.name,
        seedUrl: form.seedUrl,
        schemaId: form.schemaId || null,
        allowedDomains: domains,
        maxDepth: form.maxDepth,
        maxPages: form.maxPages,
      };
      if (editingId) {
        await ApiClient.updateScrapeSource(editingId, payload);
      } else {
        await ApiClient.createScrapeSource(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
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
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'running', lastError: null } : s)));
      await load(true);
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
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#111827' }}>Scrape Sources</h1>
          <p style={{ color: '#111827', margin: '8px 0 0' }}>
            Crawl client websites into ArcadeDB (vectors + graph) for the native agent.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0d9488',
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
        <div style={{ padding: 12, backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {showForm && (
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
            onSubmit={handleSubmit}
            style={{
              backgroundColor: '#ffffff',
              padding: 24,
              borderRadius: 8,
              width: '90%',
              maxWidth: 520,
              border: '1px solid #e5e7eb',
            }}
          >
            <h2 style={{ marginTop: 0, color: '#111827' }}>{editingId ? 'Edit scrape source' : 'New scrape source'}</h2>
            {(['name', 'seedUrl', 'allowedDomains'] as const).map((field) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: '#111827', marginBottom: 6 }}>
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
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    color: '#111827',
                  }}
                  placeholder={field === 'seedUrl' ? 'https://example.com' : ''}
                />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', color: '#111827', marginBottom: 6 }}>Link schema (optional)</label>
              <select
                value={form.schemaId}
                onChange={(e) => setForm({ ...form, schemaId: e.target.value })}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  color: '#111827',
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
                <label style={{ display: 'block', color: '#111827', marginBottom: 6 }}>Max depth</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={form.maxDepth}
                  onChange={(e) => setForm({ ...form, maxDepth: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: 8,
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    color: '#111827',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#111827', marginBottom: 6 }}>Max pages</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={form.maxPages}
                  onChange={(e) => setForm({ ...form, maxPages: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: 8,
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    color: '#111827',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ padding: '8px 12px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 6 }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '8px 12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6 }}>
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#111827' }}>Loading…</p>
      ) : sources.length === 0 ? (
        <p style={{ color: '#111827' }}>No scrape sources yet.</p>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'Seed URL', 'Status', 'Last crawl', 'Source ID', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: 12, textAlign: 'left', color: '#111827' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 12, color: '#111827' }}>{s.name}</td>
                  <td style={{ padding: 12, color: '#111827', fontFamily: 'monospace', fontSize: 12 }}>{s.seedUrl}</td>
                  <td style={{ padding: 12, color: s.status === 'failed' ? '#b91c1c' : '#111827' }}>
                    {s.status === 'running' ? 'Crawling…' : s.status}
                    {s.status === 'failed' && s.lastError ? ` — ${s.lastError}` : ''}
                  </td>
                  <td style={{ padding: 12, color: '#111827' }}>
                    {s.lastCrawledAt ? new Date(s.lastCrawledAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: 12, color: '#111827', fontFamily: 'monospace', fontSize: 12 }}>
                    {s.id}
                  </td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => openEdit(s)}
                      style={{
                        marginRight: 8,
                        padding: '6px 10px',
                        backgroundColor: '#0d9488',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setViewingId(s.id)}
                      style={{
                        marginRight: 8,
                        padding: '6px 10px',
                        backgroundColor: '#e5e7eb',
                        color: '#111827',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      View
                    </button>
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
                      {s.status === 'running' || busyId === s.id ? 'Crawling…' : 'Crawl'}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={busyId === s.id}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#b91c1c',
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
      {viewingId && (
        <ScrapedContent
          sourceId={viewingId}
          sourceName={sources.find((s) => s.id === viewingId)?.name || 'Scrape source'}
          running={sources.find((s) => s.id === viewingId)?.status === 'running'}
          onClose={() => setViewingId(null)}
        />
      )}
    </div>
  );
}
