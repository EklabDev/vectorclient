import { useRef, useState, type CSSProperties } from 'react';
import Editor from '@monaco-editor/react';
import { ApiClient } from '../services/api';
import { StudioGraph } from '../components/StudioGraph';

type Tab = 'table' | 'json' | 'graph';

export function QueryPage() {
  const [language, setLanguage] = useState<'sql' | 'cypher'>('sql');
  const [command, setCommand] = useState('SELECT FROM Chunk LIMIT 25');
  const [tab, setTab] = useState<Tab>('table');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const valueRef = useRef(command);

  const run = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await ApiClient.studioQuery({
        language,
        command: valueRef.current,
        database: 'knowledge',
      });
      setRows((res.result || []) as Record<string, unknown>[]);
      setElapsed(res.elapsedMs);
      setTab(hasGraph(res.result) ? 'graph' : 'table');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Query</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={language} onChange={(e) => setLanguage(e.target.value as 'sql' | 'cypher')}>
            <option value="sql">SQL</option>
            <option value="cypher">Cypher</option>
          </select>
          <button onClick={run} disabled={running} style={btn}>
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>
      <div style={{ height: 220, border: '1px solid #2a2e38', borderRadius: 8, overflow: 'hidden' }}>
        <Editor
          height="220px"
          theme="vs-dark"
          language="sql"
          defaultValue={command}
          onChange={(v) => {
            valueRef.current = v || '';
            setCommand(v || '');
          }}
          options={{ minimap: { enabled: false }, fontSize: 13 }}
        />
      </div>
      {error && <div style={{ color: '#fca5a5' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['table', 'graph', 'json'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...btn, background: tab === t ? '#3b82f6' : '#2a2e38' }}>
            {t}
          </button>
        ))}
        {elapsed != null && <span style={{ color: '#9aa3b5', alignSelf: 'center' }}>{elapsed} ms · {rows.length} rows</span>}
      </div>
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #2a2e38', borderRadius: 8, padding: 12 }}>
        {tab === 'json' && <pre style={{ margin: 0 }}>{JSON.stringify(rows, null, 2)}</pre>}
        {tab === 'table' && <ResultTable rows={rows} />}
        {tab === 'graph' && <StudioGraph rows={rows} />}
      </div>
    </div>
  );
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <div style={{ color: '#9aa3b5' }}>No rows</div>;
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !k.startsWith('@')))));
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {keys.map((k) => (
            <th key={k} style={{ textAlign: 'left', borderBottom: '1px solid #2a2e38', padding: 6 }}>{k}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {keys.map((k) => (
              <td key={k} style={{ padding: 6, borderBottom: '1px solid #222' }}>
                {formatCell(row[k])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function hasGraph(result: unknown[] | undefined): boolean {
  return Boolean(result?.some((r) => r && typeof r === 'object' && ('@rid' in (r as object) || 'key' in (r as object))));
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const btn: CSSProperties = {
  padding: '6px 12px',
  backgroundColor: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};
