'use client';

import { useEffect } from 'react';
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/35 p-2 sm:p-4">
      <div className="mx-auto my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-3xl flex-col rounded-md border border-[var(--border)] bg-white shadow-lg sm:my-6">
        <div className="flex h-10 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--toolbar-background)] px-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            aria-label="Закрити"
            className="btn btn-outline !min-h-7 !w-auto !px-2"
            type="button"
            onClick={onClose}
          >
            Г—
          </button>
        </div>
        <div className="compact-scrollbar min-h-0 overflow-y-auto p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-[13px] font-medium text-[var(--text-primary)] sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Select({
  value,
  onChange,
  children,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <select
      className="input"
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

export function FormActions({
  saving,
  onClose,
}: {
  saving: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-0 pt-3 sm:flex-row sm:justify-end">
      <button
        className="btn btn-outline"
        type="button"
        onClick={onClose}
      >
        Скасувати
      </button>
      <button
        className="btn btn-primary"
        disabled={saving}
        type="submit"
      >
        {saving ? 'Збереження...' : 'Зберегти'}
      </button>
    </div>
  );
}

