import { useState } from 'react';
import { ApiClient } from '../../services/api';

export function SchemaEditor({ schemaId }: { schemaId?: string }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(''); // Markdown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (schemaId) {
        await ApiClient.updateSchema(schemaId, { name, description, content });
      } else {
        await ApiClient.createSchema({ name, description, content });
      }
      // Success - navigate or show message
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Schema Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        placeholder="Markdown Content (Knowledge Base)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        rows={15}
        style={{ fontFamily: 'monospace' }}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Schema'}
      </button>
    </form>
  );
}
