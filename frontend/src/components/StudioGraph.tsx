import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

type Row = Record<string, unknown>;

function nodeId(row: Row, i: number): string {
  return String(row['@rid'] || row.key || row.id || `n${i}`);
}

function nodeLabel(row: Row, i: number): string {
  return String(row.name || row.key || row.id || row['@rid'] || i).slice(0, 24);
}

export function StudioGraph({ rows }: { rows: Row[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const nodes = rows.filter((r) => r['@rid'] || r.key || r.name || r.id);
    if (nodes.length === 0) return;
    const elements: cytoscape.ElementDefinition[] = nodes.map((n, i) => ({
      data: { id: nodeId(n, i), label: nodeLabel(n, i) },
    }));
    const seen = new Set(elements.map((e) => e.data.id));
    rows.forEach((row, i) => {
      const from = row.from || row.out || row['@out'];
      const to = row.to || row.in || row['@in'];
      if (from && to) {
        const source = String(from);
        const target = String(to);
        if (!seen.has(source)) {
          elements.push({ data: { id: source, label: source.slice(0, 12) } });
          seen.add(source);
        }
        if (!seen.has(target)) {
          elements.push({ data: { id: target, label: target.slice(0, 12) } });
          seen.add(target);
        }
        elements.push({ data: { id: `e${i}`, source, target } });
      }
    });
    const cy = cytoscape({
      container: ref.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#2a3142',
            'border-color': '#3b82f6',
            'border-width': 1,
            label: 'data(label)',
            color: '#e8eaed',
            'font-size': 10,
            'text-valign': 'center',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': '#4b5563',
            'target-arrow-color': '#4b5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
      ],
      layout: { name: 'cose', animate: false },
    });
    return () => {
      cy.destroy();
    };
  }, [rows]);

  if (rows.every((r) => !(r['@rid'] || r.key || r.name || r.id))) {
    return <div style={{ color: '#9aa3b5' }}>No graph vertices in this result. Try a Cypher MATCH.</div>;
  }
  return <div ref={ref} style={{ width: '100%', height: 420, background: '#12141a' }} />;
}
