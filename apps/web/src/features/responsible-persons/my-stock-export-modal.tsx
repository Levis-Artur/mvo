'use client';

import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import type { MyPropertySection } from '@/lib/types';
import { MY_PROPERTY_SECTION_LABELS } from './my-stock-model';

export function MyStockExportModal({
  currentSection,
  search,
  loading,
  onClose,
  onExport,
}: {
  currentSection: MyPropertySection;
  search: string;
  loading: boolean;
  onClose: () => void;
  onExport: (scope: 'ALL' | 'CURRENT') => void;
}) {
  const [scope, setScope] = useState<'ALL' | 'CURRENT'>('ALL');
  return <Modal
    closeOnEscape={!loading}
    footer={<>
      <Button disabled={loading} variant="outline" type="button" onClick={onClose}>Скасувати</Button>
      <Button disabled={loading} type="button" onClick={() => onExport(scope)}>
        {loading ? 'Формування CSV…' : 'Завантажити CSV'}
      </Button>
    </>}
    onClose={onClose}
    size="small"
    title="Експорт майна"
  >
    <fieldset className="grid gap-3" disabled={loading}>
      <legend className="mb-2 text-sm font-bold">Оберіть область експорту</legend>
      <label className="ui-checkbox">
        <input checked={scope === 'ALL'} name="export-scope" type="radio" onChange={() => setScope('ALL')} />
        <span>Усе моє майно</span>
      </label>
      <label className="ui-checkbox">
        <input checked={scope === 'CURRENT'} name="export-scope" type="radio" onChange={() => setScope('CURRENT')} />
        <span>Лише поточна вкладка — {MY_PROPERTY_SECTION_LABELS[currentSection]}</span>
      </label>
    </fieldset>
    {search ? <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
      До експорту буде застосовано пошук: <strong>{search}</strong>
    </p> : null}
  </Modal>;
}
