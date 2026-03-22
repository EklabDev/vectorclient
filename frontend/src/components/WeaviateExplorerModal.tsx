import { useEffect, useState } from 'react';
import { ApiClient, WeaviateChunkObject } from '../services/api';

type ExplorerMode = 'view' | 'edit';

interface Props {
  open: boolean;
  onClose: () => void;
  schemaId: string;
  schemaName: string;
  /** Initial system prompt from schema row; edit mode can PATCH it. */
  systemPrompt: string | null;
  mode: ExplorerMode;
  onSystemPromptSaved?: (prompt: string | null) => void;
  /** Called after create/update/delete chunk so parent can refresh card counts. */
  onWeaviateMutated?: () => void;
}

export function WeaviateExplorerModal({
  open,
  onClose,
  schemaId,
  schemaName,
  systemPrompt: initialSystemPrompt,
  mode,
  onSystemPromptSaved,
  onWeaviateMutated,
}: Props) {
  const [objects, setObjects] = useState<WeaviateChunkObject[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'bm25' | 'vector'>('bm25');
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [systemPromptDraft, setSystemPromptDraft] = useState(initialSystemPrompt ?? '');
  const [selected, setSelected] = useState<WeaviateChunkObject | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newRef, setNewRef] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');

  const isEdit = mode === 'edit';

  useEffect(() => {
    if (open) {
      setSystemPromptDraft(initialSystemPrompt ?? '');
    }
  }, [open, initialSystemPrompt]);

  const loadList = async () => {
    setLoading(true);
    setError('');
    setShowSearchResults(false);
    try {
      const res = await ApiClient.getWeaviateObjects(schemaId);
      setObjects(res.objects);
      setTruncated(res.truncated);
    } catch (e) {
      setError((e as Error).message);
      setObjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadList();
    }
  }, [open, schemaId]);

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      void loadList();
      return;
    }
    setSearching(true);
    setError('');
    try {
      const res = await ApiClient.searchWeaviateObjects(schemaId, { query: q, mode: searchMode });
      setObjects(res.objects);
      setShowSearchResults(true);
      setTruncated(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const saveSystemPrompt = async () => {
    if (
      !window.confirm(
        'Update system prompt for this schema? (This does not re-publish chunk content to Weaviate.)'
      )
    ) {
      return;
    }
    try {
      setError('');
      await ApiClient.updateSchema(schemaId, {
        systemPrompt: systemPromptDraft.trim() || null,
      });
      onSystemPromptSaved?.(systemPromptDraft.trim() || null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveChunkEdits = async () => {
    if (!selected) return;
    if (!editContent.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    if (!window.confirm('Save changes to this chunk in Weaviate?')) return;
    try {
      setError('');
      await ApiClient.patchWeaviateChunk(schemaId, selected.id, {
        content: editContent.trim(),
        category: editCategory,
        subcategory: editSubcategory,
      });
      setSelected(null);
      setEditCategory('');
      setEditSubcategory('');
      await loadList();
      onWeaviateMutated?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createChunk = async () => {
    if (!newContent.trim()) return;
    if (!window.confirm('Create a new chunk object in Weaviate?')) return;
    try {
      setError('');
      await ApiClient.createWeaviateObject(schemaId, {
        content: newContent.trim(),
        originalReference: newRef.trim() || undefined,
        category: newCategory.trim() || undefined,
        subcategory: newSubcategory.trim() || undefined,
      });
      setNewContent('');
      setNewRef('');
      setNewCategory('');
      setNewSubcategory('');
      await loadList();
      onWeaviateMutated?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteChunk = async (obj: WeaviateChunkObject) => {
    if (!window.confirm(`Delete chunk ${obj.id.slice(0, 8)}… from Weaviate? This cannot be undone.`)) return;
    try {
      setError('');
      await ApiClient.deleteWeaviateObject(schemaId, obj.id);
      if (selected?.id === obj.id) {
        setSelected(null);
        setEditCategory('');
        setEditSubcategory('');
      }
      await loadList();
      onWeaviateMutated?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!open) return null;

  const displayRows = objects;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: '#27272a',
          borderRadius: 8,
          border: '1px solid #3f3f46',
          width: 'min(1100px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', flexShrink: 0 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 18 }}>
            {isEdit ? 'Edit vectors' : 'View vectors'} — {schemaName}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#a1a1aa' }}>
            Weaviate chunks for schema <code style={{ color: '#93c5fd' }}>{schemaId}</code>
          </p>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ padding: 12, backgroundColor: '#7f1d1d', color: '#fecaca', borderRadius: 6, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {isEdit && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#18181b', borderRadius: 6 }}>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 6 }}>System prompt (schema)</label>
              <textarea
                value={systemPromptDraft}
                onChange={(e) => setSystemPromptDraft(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 8,
                }}
              />
              <button
                type="button"
                onClick={() => void saveSystemPrompt()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Save system prompt
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search query…"
              style={{
                flex: '1 1 200px',
                padding: 8,
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                color: '#fff',
              }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => setSearchMode('bm25')}
                style={{
                  padding: '6px 10px',
                  backgroundColor: searchMode === 'bm25' ? '#3b82f6' : '#3f3f46',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                BM25
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('vector')}
                style={{
                  padding: '6px 10px',
                  backgroundColor: searchMode === 'vector' ? '#3b82f6' : '#3f3f46',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Vector
              </button>
            </div>
            <button
              type="button"
              disabled={searching}
              onClick={() => void runSearch()}
              style={{
                padding: '8px 14px',
                backgroundColor: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: searching ? 'not-allowed' : 'pointer',
              }}
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
            <button
              type="button"
              onClick={() => void loadList()}
              style={{
                padding: '8px 14px',
                backgroundColor: '#52525b',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Clear / Reload all
            </button>
          </div>

          {isEdit && (
            <fieldset
              style={{
                marginBottom: 16,
                padding: '12px 14px 14px',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                backgroundColor: '#18181b',
              }}
            >
              <legend style={{ color: '#e4e4e7', fontSize: 14, padding: '0 6px' }}>Create new chunk</legend>
              <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 12px' }}>
                Chunk index is assigned automatically (max existing index + 1). Schema id, name, and version are set from
                this schema.
              </p>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Content *</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>
                Original reference
              </label>
              <input
                type="text"
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Category</label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                maxLength={50}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Subcategory</label>
              <input
                type="text"
                value={newSubcategory}
                onChange={(e) => setNewSubcategory(e.target.value)}
                maxLength={50}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => void createChunk()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Create chunk
              </button>
            </fieldset>
          )}

          {showSearchResults && (
            <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>Showing search results (max 10).</p>
          )}
          {truncated && !showSearchResults && (
            <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>
              List truncated: more than 500 objects exist. Use search or Weaviate console for full data.
            </p>
          )}

          {loading ? (
            <p style={{ color: '#a1a1aa' }}>Loading objects…</p>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '45vh', border: '1px solid #3f3f46', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#18181b', zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8, color: '#a1a1aa' }}>Idx</th>
                    <th style={{ textAlign: 'left', padding: 8, color: '#a1a1aa' }}>Content (preview)</th>
                    <th style={{ textAlign: 'left', padding: 8, color: '#a1a1aa' }}>Cat / Sub</th>
                    {isEdit && <th style={{ padding: 8, color: '#a1a1aa' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((o) => (
                    <tr key={o.id} style={{ borderTop: '1px solid #3f3f46' }}>
                      <td style={{ padding: 8, color: '#e4e4e7', verticalAlign: 'top' }}>{o.chunkIndex ?? '—'}</td>
                      <td style={{ padding: 8, color: '#d4d4d8', maxWidth: 420, wordBreak: 'break-word' }}>
                        {(o.content || '').slice(0, 200)}
                        {(o.content?.length || 0) > 200 ? '…' : ''}
                        {o.score != null && (
                          <span style={{ display: 'block', fontSize: 10, color: '#71717a' }}>score: {String(o.score)}</span>
                        )}
                      </td>
                      <td style={{ padding: 8, color: '#a1a1aa', verticalAlign: 'top' }}>
                        {[o.category, o.subcategory].filter(Boolean).join(' / ') || '—'}
                      </td>
                      {isEdit && (
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(o);
                              setEditContent(o.content || '');
                              setEditCategory(o.category ?? '');
                              setEditSubcategory(o.subcategory ?? '');
                            }}
                            style={{
                              marginRight: 6,
                              padding: '4px 8px',
                              backgroundColor: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 11,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteChunk(o)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#991b1b',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 11,
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayRows.length === 0 && <p style={{ padding: 16, color: '#71717a' }}>No objects.</p>}
            </div>
          )}

          {isEdit && selected && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#18181b', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 10 }}>
                Edit chunk <code style={{ color: '#93c5fd' }}>{selected.id}</code> — updates content, category, and
                subcategory (merge). Chunk index is not changed.
              </div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Content *</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Category</label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                maxLength={50}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 4 }}>Subcategory</label>
              <input
                type="text"
                value={editSubcategory}
                onChange={(e) => setEditSubcategory(e.target.value)}
                maxLength={50}
                style={{
                  width: '100%',
                  padding: 8,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void saveChunkEdits()}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Save chunk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setEditCategory('');
                    setEditSubcategory('');
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#52525b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid #3f3f46', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: 10,
              backgroundColor: '#3f3f46',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
