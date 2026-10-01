import { useState, useRef, useEffect, useMemo } from 'react';

interface AutocompleteOption {
  id: string;
  label: string;
  [key: string]: any;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  selected: AutocompleteOption[];
  onChange: (selected: AutocompleteOption[]) => void;
  placeholder?: string;
  getOptionLabel?: (option: AutocompleteOption) => string;
}

export function Autocomplete({
  options,
  selected,
  onChange,
  placeholder = 'Type to search...',
  getOptionLabel = (option) => option.label,
}: AutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const getOptionLabelRef = useRef(getOptionLabel);
  
  // Keep ref updated
  useEffect(() => {
    getOptionLabelRef.current = getOptionLabel;
  }, [getOptionLabel]);

  // Memoize filtered options to avoid infinite loops
  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) {
      return [];
    }
    const selectedIdSet = new Set(selected.map((s) => s.id));
    return options.filter((option) => {
      if (selectedIdSet.has(option.id)) return false;
      const label = getOptionLabelRef.current ? getOptionLabelRef.current(option) : option.label;
      return label.toLowerCase().includes(inputValue.toLowerCase());
    });
  }, [inputValue, options, selected]);

  // Update isOpen based on filtered options
  useEffect(() => {
    if (inputValue.trim() && filteredOptions.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [inputValue, filteredOptions.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: AutocompleteOption) => {
    onChange([...selected, option]);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemove = (id: string) => {
    onChange(selected.filter((s) => s.id !== id));
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Selected items */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          {selected.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                backgroundColor: '#0d9488',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              <span>{getOptionLabelRef.current ? getOptionLabelRef.current(item) : item.label}</span>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#111827',
                  cursor: 'pointer',
                  padding: '0',
                  fontSize: '16px',
                  lineHeight: '1',
                  fontWeight: 'bold',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={() => {
          if (filteredOptions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          color: '#111827',
          fontSize: '14px',
        }}
      />

      {/* Dropdown */}
      {isOpen && filteredOptions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
          }}
        >
          {filteredOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => handleSelect(option)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                color: '#111827',
                fontSize: '14px',
                borderBottom: '1px solid #e5e7eb',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {getOptionLabelRef.current ? getOptionLabelRef.current(option) : option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
