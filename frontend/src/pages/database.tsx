import { useEffect, useState } from 'react';
import { ApiClient } from '../services/api';

export function DatabasePage() {
  const [types, setTypes] = useState<Record<string, unknown>[]>([]);
  const [indexes, setIndexes] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [samples, setSamples] = useState<unknown[]>([]);

  const load = async () => {
    setError('');
    try {
      const res = await ApiClient.studioSchema('knowledge');
      setTypes((res.types || []) as Record<string, unknown>[]);
      setIndexes((res.indexes || []) as Record<string, unknown>[]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Database</h1>
      </div>
      <p style={{ color: '#9aa3b5' }}>Types, properties, and indexes in your ArcadeDB database.</p>
      {error && <div style={{ color: '#fca5a5' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #2a2e38', borderRadius: 8, padding: 8, maxHeight: 640, overflow: 'auto' }}>
          {types.map((t, i) => {
            const name = String(t.name || t.typeName || t['@rid'] || i);
            return (
              <button
                key={name}
                onClick={async () => {
                  setSelected(t);
                  setSamples([]);
                  const safe = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
                  if (!safe) return;
                  try {
                    const res = await ApiClient.studioQuery({
                      language: 'sql',
                      command: `SELECT FROM ${name} LIMIT 5`,
                      database: 'knowledge',
                    });
                    setSamples(res.result || []);
                  } catch {
                    setSamples([]);
                  }
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: selected === t ? '#2a3142' : 'transparent',
                  color: '#e8eaed',
                  border: 'none',
                  padding: 8,
                  cursor: 'pointer',
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
        <pre style={{ border: '1px solid #2a2e38', borderRadius: 8, padding: 16, overflow: 'auto' }}>
          {JSON.stringify({ selected, indexes: indexes.slice(0, 40), samples }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
