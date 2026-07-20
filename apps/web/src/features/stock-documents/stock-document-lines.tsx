'use client';

import type { AvailableStockSource } from '@/lib/types';
import { Button, Card, DataTable, EmptyState, StatusBadge } from '@/components/ui';
import { addQuantities, formatQuantity } from '@/features/inventory/quantity-format';
import type { DocumentFormLine } from './stock-document.types';
import {
  availableSourceOptions,
  canAddDocumentLine,
  documentLineError,
} from './stock-document-rules';

export function StockDocumentLines({ sources, lines, disabled, loading, onChange }: {
  sources: AvailableStockSource[];
  lines: DocumentFormLine[];
  disabled: boolean;
  loading: boolean;
  onChange: (lines: DocumentFormLine[]) => void;
}) {
  const selectedIds = lines.map((line) => line.inventoryItemId);

  function addLine() {
    const option = availableSourceOptions(sources, selectedIds)[0];
    if (option) onChange([...lines, sourceToLine(option)]);
  }

  function updateLine(index: number, patch: Partial<DocumentFormLine>) {
    onChange(lines.map((line, current) => current === index ? { ...line, ...patch } : line));
  }

  return <Card title="Рядки документа">
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-text-secondary)]">Доступні лише позиції з позитивним залишком.</p>
        <Button disabled={!canAddDocumentLine(sources, selectedIds, !disabled, loading)} variant="outline" type="button" onClick={addLine}>Додати позицію</Button>
      </div>
      {!loading && !lines.length ? <EmptyState message={disabled ? 'Спочатку виберіть МВО-відправника.' : 'Додайте позицію з доступних залишків.'} /> : null}
      {lines.length ? <DataTable
        ariaLabel="Рядки документа руху майна"
        columns={[
          { label: 'Джерело' }, { label: 'Назва' }, { label: 'Обліковий власник' },
          { label: 'Поточний утримувач' }, { label: 'Одиниця' },
          { label: 'Доступно', numeric: true }, { label: 'Кількість', numeric: true },
          { label: 'Примітка' }, { label: 'Дії', actions: true },
        ]}
        loading={loading}
        rows={lines.map((line, index) => {
          const current = sources.find((item) => item.sourceBalanceId === line.sourceBalanceId);
          const options = sources.filter((item) =>
            item.inventoryItem.id === line.inventoryItemId || !selectedIds.includes(item.inventoryItem.id),
          );
          const lineError = documentLineError(line, sources);
          return [
            <select aria-label={`Джерело рядка ${index + 1}`} className="input min-w-64" key="item" value={line.sourceBalanceId} onChange={(event) => {
              const source = sources.find((item) => item.sourceBalanceId === event.target.value);
              if (source) updateLine(index, sourceToLine(source));
            }}>
              {options.map((source) => <option key={source.sourceBalanceId} value={source.sourceBalanceId}>{source.sourceKind === 'DIRECT' ? 'Безпосередньо' : 'Закріплено'} · {source.inventoryItem.externalCode} — {source.inventoryItem.name}</option>)}
            </select>,
            <span className="block max-w-56 break-words" key="name">{current?.inventoryItem.name ?? '—'}</span>,
            <span className="block max-w-48 break-words" key="owner">{current?.accountingOwner.fullName ?? '—'}</span>,
            <span className="block max-w-48 break-words" key="holder">{current?.currentCustodian.fullName ?? '—'}<StatusBadge tone={line.sourceKind === 'DIRECT' ? 'success' : 'info'}>{line.sourceKind}</StatusBadge></span>,
            current?.inventoryItem.unitOfMeasure ?? '—',
            current ? formatQuantity(current.availableQuantity) : '—',
            <div className="min-w-32" key="quantity"><input aria-label={`Кількість рядка ${index + 1}`} aria-invalid={Boolean(line.quantity && lineError)} className="input text-right" max={current?.availableQuantity} min="0" step="any" type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />{line.quantity && lineError ? <p className="mt-1 text-left text-xs text-[var(--color-danger)]" role="alert">{lineError}</p> : null}</div>,
            <input aria-label={`Примітка рядка ${index + 1}`} className="input min-w-40" key="note" value={line.note} onChange={(event) => updateLine(index, { note: event.target.value })} />,
            <Button aria-label={`Видалити рядок ${index + 1}`} key="remove" variant="danger" type="button" onClick={() => onChange(lines.filter((_, currentIndex) => currentIndex !== index))}>Видалити</Button>,
          ];
        })}
      /> : null}
      <div className="flex justify-end gap-6 border-t border-[var(--color-border-light)] pt-3 text-sm">
        <span>Позицій: <strong>{lines.length}</strong></span>
        <span>Загальна кількість: <strong>{formatQuantity(addQuantities(lines.map((line) => line.quantity || '0')))}</strong></span>
      </div>
    </div>
  </Card>;
}

export function sourceToLine(source: AvailableStockSource): DocumentFormLine {
  return {
    inventoryItemId: source.inventoryItem.id,
    sourceKind: source.sourceKind,
    sourceBalanceId: source.sourceBalanceId,
    accountingOwnerResponsiblePersonId: source.accountingOwner.id,
    sourceCustodianResponsiblePersonId:
      source.sourceKind === 'ASSIGNED' ? source.currentCustodian.id : undefined,
    sourceCustodyBalanceId:
      source.sourceKind === 'ASSIGNED' ? source.sourceBalanceId : undefined,
    quantity: '',
    note: '',
  };
}
