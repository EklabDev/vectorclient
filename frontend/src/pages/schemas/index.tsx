import { useState, useEffect } from 'react';
import { ApiClient } from '../../services/api';

interface Schema {
  id: string;
  name: string;
  description: string | null;
  content: string;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SchemasPage() {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchema, setEditingSchema] = useState<Schema | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await ApiClient.getSchemas();
      // Handle both array and object with message property
      if (Array.isArray(data)) {
        setSchemas(data);
      } else if (data && typeof data === 'object' && 'message' in data) {
        setSchemas([]);
      } else {
        setSchemas([]);
      }
    } catch (err) {
      setError((err as Error).message);
      setSchemas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        name: formData.name,
        description: formData.description || null,
        content: formData.content,
      };

      if (editingSchema) {
        await ApiClient.updateSchema(editingSchema.id, payload);
      } else {
        await ApiClient.createSchema(payload);
      }

      setShowCreateModal(false);
      setEditingSchema(null);
      resetForm();
      await loadSchemas();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (schema: Schema) => {
    setEditingSchema(schema);
    setFormData({
      name: schema.name,
      description: schema.description || '',
      content: schema.content,
    });
    setViewMode(false);
    setShowCreateModal(true);
  };

  const [viewMode, setViewMode] = useState(false);

  const handleView = (schema: Schema) => {
    setEditingSchema(schema);
    setFormData({
      name: schema.name,
      description: schema.description || '',
      content: schema.content,
    });
    setViewMode(true);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schema? This action cannot be undone.')) {
      return;
    }
    try {
      setDeletingId(id);
      setError('');
      await ApiClient.deleteSchema(id);
      await loadSchemas();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      content: '',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#fff' }}>Schemas & Knowledge</h1>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setEditingSchema(null);
            setViewMode(false);
            resetForm();
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Add Schema
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#7f1d1d',
          color: '#fca5a5',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#27272a',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '800px',
            border: '1px solid #3f3f46',
            margin: 'auto',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#fff' }}>
              {viewMode ? 'View Schema' : editingSchema ? 'Edit Schema' : 'Create New Schema'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Schema Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={viewMode}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    opacity: viewMode ? 0.6 : 1
                  }}
                  placeholder="e.g., Product Documentation"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={viewMode}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    opacity: viewMode ? 0.6 : 1
                  }}
                  placeholder="Optional description"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Markdown Content (Knowledge Base) *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  disabled={viewMode}
                  rows={15}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    opacity: viewMode ? 0.6 : 1
                  }}
                  placeholder="# Your Markdown Content Here..."
                />
              </div>

              {!viewMode && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {editingSchema ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingSchema(null);
                      setViewMode(false);
                      resetForm();
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#3f3f46',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {viewMode && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingSchema(null);
                    setViewMode(false);
                    resetForm();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#3f3f46',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>Loading schemas...</div>
      ) : schemas.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#a1a1aa',
          backgroundColor: '#27272a',
          borderRadius: '8px',
          border: '1px solid #3f3f46'
        }}>
          No schemas found. Add markdown content to power your AI endpoints.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {schemas.map((schema) => (
            <div
              key={schema.id}
              style={{
                backgroundColor: '#27272a',
                borderRadius: '8px',
                border: '1px solid #3f3f46',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#fff' }}>{schema.name}</h3>
              {schema.description && (
                <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '12px' }}>
                  {schema.description}
                </p>
              )}
              <div style={{ marginBottom: '12px', fontSize: '12px', color: '#71717a' }}>
                <div>Version: {schema.version}</div>
                <div>Status: {schema.isPublished ? (
                  <span style={{ color: '#10b981' }}>Published</span>
                ) : (
                  <span style={{ color: '#a1a1aa' }}>Draft</span>
                )}</div>
                <div>Updated: {formatDate(schema.updatedAt)}</div>
              </div>
              <div style={{
                flex: 1,
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: '#18181b',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#a1a1aa',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxHeight: '100px',
                overflowY: 'auto'
              }}>
                {schema.content.substring(0, 200)}
                {schema.content.length > 200 && '...'}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => handleView(schema)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  View
                </button>
                <button
                  onClick={() => handleEdit(schema)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(schema.id)}
                  disabled={deletingId === schema.id}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: deletingId === schema.id ? '#3f3f46' : '#7f1d1d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: deletingId === schema.id ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {deletingId === schema.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
