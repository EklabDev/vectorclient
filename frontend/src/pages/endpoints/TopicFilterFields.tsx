import type { CSSProperties } from 'react';

export type TopicFilterForm = {
  enabled: boolean;
  minSimilarity: number;
  offTopicReply: string;
};

export const DEFAULT_TOPIC_FILTER_FORM: TopicFilterForm = {
  enabled: true,
  minSimilarity: 0.4,
  offTopicReply:
    'I can only help with questions about this organization and its programs. Please ask about schedules, offerings, enrollment, or contact information.',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: '#a1a1aa',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px',
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
};

type Props = {
  value: TopicFilterForm;
  onChange: (next: TopicFilterForm) => void;
};

export function TopicFilterFields({ value, onChange }: Props) {
  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px',
        border: '1px solid #3f3f46',
        borderRadius: '8px',
        backgroundColor: '#18181b',
      }}
    >
      <div style={{ marginBottom: '12px', color: '#fff', fontWeight: 600 }}>Topic filter</div>
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          style={{ cursor: 'pointer' }}
          id="topic-filter-enabled"
        />
        <label htmlFor="topic-filter-enabled" style={{ color: '#a1a1aa', cursor: 'pointer' }}>
          Restrict to knowledge topics
        </label>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>Minimum similarity (0–1)</label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          disabled={!value.enabled}
          value={value.minSimilarity}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange({
              ...value,
              minSimilarity: Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : value.minSimilarity,
            });
          }}
          style={{
            ...inputStyle,
            opacity: value.enabled ? 1 : 0.5,
            cursor: value.enabled ? 'text' : 'not-allowed',
          }}
        />
      </div>
      <div>
        <label style={labelStyle}>Off-topic reply</label>
        <textarea
          disabled={!value.enabled}
          value={value.offTopicReply}
          onChange={(e) => onChange({ ...value, offTopicReply: e.target.value })}
          rows={3}
          style={{
            ...inputStyle,
            fontFamily: 'inherit',
            resize: 'vertical',
            opacity: value.enabled ? 1 : 0.5,
            cursor: value.enabled ? 'text' : 'not-allowed',
          }}
          placeholder="Message returned when the question is filtered"
        />
      </div>
    </div>
  );
}
