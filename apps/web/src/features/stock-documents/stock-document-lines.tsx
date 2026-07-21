'use client';

import type { AvailableStockSource } from '@/lib/types';
import { Button, Card, DataTable, EmptyState, Input, StatusBadge } from '@/components/ui';
import { addQuantities, formatQuantity } from '@/features/inventory/quantity-format';
import type { DocumentFormLine } from './stock-document.types';
import { documentLineError } from './stock-document-rules';
import {
  canOpenSourcePicker,
  findStockSourceForLine,
  removeDocumentLine,
  stockSourceKindLabel,
} from './stock-source-picker-model';

export function StockDocumentLines({
  sources,
  lines,
  disabled,
  loading,
  simplified,
  type,
  onAddRequest,
  onChange,
}: {
  sources: AvailableStockSource[];
  lines: DocumentFormLine[];
  disabled: boolean;
  loading: boolean;
  simplified: boolean;
  type: 'ASSIGNMENT' | 'ISSUE' | 'TRANSFER';
  onAddRequest: () => void;
  onChange: (lines: DocumentFormLine[]) => void;
}) {
  function updateLine(index: number, patch: Partial<DocumentFormLine>) {
    onChange(lines.map((line, current) => current === index ? { ...line, ...patch } : line));
  }

  return <Card title={simplified ? (type === 'ASSIGNMENT' ? 'Що і скільки передаємо' : 'Що і скільки видаємо') : 'Рядки документа'}>
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {simplified
            ? 'Оберіть потрібну позицію та вкажіть кількість.'
            : 'Доступні лише позиції з позитивним залишком. Джерело обирається явно.'}
        </p>
        <Button
          disabled={!canOpenSourcePicker(!disabled)}
          variant="outline"
          type="button"
          onClick={onAddRequest}
        >
          Додати позицію
        </Button>
      </div>
      {!loading && !lines.length ? <EmptyState message={disabled
        ? 'Спочатку виберіть МВО-відправника.'
        : 'Додайте позицію з доступного майна.'} /> : null}
      {lines.length ? <DataTable
        ariaLabel="Рядки документа руху майна"
        columns={simplified ? [
          { label: 'Код' },
          { label: 'Назва', className: 'stock-document-lines__name' },
          { label: 'Доступно', numeric: true, className: 'stock-document-lines__available' },
          { label: 'Кількість', numeric: true, className: 'stock-document-lines__quantity' },
          { label: 'Одиниця' },
          { label: 'Від кого', className: 'stock-document-lines__person' },
          { label: 'Примітка', className: 'stock-document-lines__note' },
          { label: 'Дії', actions: true },
        ] : [
          { label: 'Джерело', className: 'stock-document-lines__source' },
          { label: 'Назва', className: 'stock-document-lines__name' },
          { label: 'Доступно', numeric: true, className: 'stock-document-lines__available' },
          { label: 'Кількість', numeric: true, className: 'stock-document-lines__quantity' },
          { label: 'Одиниця' },
          { label: 'Обліковий власник', className: 'stock-document-lines__person' },
          { label: 'Поточний утримувач', className: 'stock-document-lines__person' },
          { label: 'Примітка', className: 'stock-document-lines__note' },
          { label: 'Дії', actions: true },
        ]}
        loading={loading}
        rows={lines.map((line, index) => {
          const current = findStockSourceForLine(sources, line);
          const lineError = documentLineError(line, sources);
          const quantityControl = <div className="stock-document-lines__quantity-control" key="quantity">
            <Input
              aria-label={`Кількість рядка ${index + 1}`}
              aria-invalid={line.quantity !== '' && Boolean(lineError)}
              max={current?.availableQuantity}
              min="0"
              required
              step="any"
              type="number"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
            />
            {line.quantity !== '' && lineError ? <p className="form-field__error" role="alert">{lineError}</p> : null}
            {current ? <p className="form-field__hint">Максимум: {formatQuantity(current.availableQuantity)}</p> : null}
          </div>;
          const note = <Input
            aria-label={`Примітка рядка ${index + 1}`}
            key="note"
            value={line.note}
            onChange={(event) => updateLine(index, { note: event.target.value })}
          />;
          const remove = <Button
            aria-label={`Видалити рядок ${index + 1}`}
            key="remove"
            variant="danger"
            type="button"
            onClick={() => onChange(removeDocumentLine(lines, index))}
          >
            Видалити
          </Button>;
          if (simplified) return [
            current?.inventoryItem.externalCode ?? '—',
            <span className="stock-document-lines__name-text" key="name">{current?.inventoryItem.name ?? 'Позиція недоступна'}</span>,
            current ? formatQuantity(current.availableQuantity) : '—',
            quantityControl,
            current?.inventoryItem.unitOfMeasure ?? '—',
            current?.sourceKind === 'ASSIGNED' ? current.accountingOwner.fullName : 'У вас',
            note,
            remove,
          ];
          return [
            <StatusBadge key="source" tone={line.sourceKind === 'DIRECT' ? 'success' : 'info'}>
              {stockSourceKindLabel(line.sourceKind)}
            </StatusBadge>,
            <span className="stock-document-lines__name-text" key="name">
              {current?.inventoryItem.name ?? 'Джерело недоступне'}
            </span>,
            current ? formatQuantity(current.availableQuantity) : '—',
            quantityControl,
            current?.inventoryItem.unitOfMeasure ?? '—',
            current?.accountingOwner.fullName ?? '—',
            current?.currentCustodian.fullName ?? '—',
            note,
            remove,
          ];
        })}
        tableClassName={`stock-document-lines-table${simplified ? ' stock-document-lines-table--mvo' : ''}`}
      /> : null}
      <div className="flex justify-end gap-6 border-t border-[var(--color-border-light)] pt-3 text-sm">
        <span>Позицій: <strong>{lines.length}</strong></span>
        <span>Загальна кількість: <strong>{formatQuantity(addQuantities(lines.map((line) => line.quantity || '0')))}</strong></span>
      </div>
    </div>
  </Card>;
}
