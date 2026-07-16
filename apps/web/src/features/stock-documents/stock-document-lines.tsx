'use client';

import type { StockBalance } from '@/lib/types';
import type { DocumentFormLine } from './stock-document.types';
import { availableBalanceOptions } from './stock-document-rules';

export function StockDocumentLines({
  balances,
  lines,
  disabled,
  onChange,
}: {
  balances: StockBalance[];
  lines: DocumentFormLine[];
  disabled: boolean;
  onChange: (lines: DocumentFormLine[]) => void;
}) {
  function addLine() {
    const option = availableBalanceOptions(
      balances,
      lines.map((line) => line.inventoryItemId),
    )[0];
    if (option) {
      onChange([
        ...lines,
        { inventoryItemId: option.inventoryItem.id, quantity: '', note: '' },
      ]);
    }
  }

  function updateLine(index: number, patch: Partial<DocumentFormLine>) {
    onChange(lines.map((line, current) => current === index ? { ...line, ...patch } : line));
  }

  const selectedIds = lines.map((line) => line.inventoryItemId);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Позиції документа</h4>
        <button
          className="btn btn-outline !w-auto"
          disabled={disabled || availableBalanceOptions(balances, selectedIds).length === 0}
          type="button"
          onClick={addLine}
        >
          Додати позицію
        </button>
      </div>
      {lines.length === 0 ? (
        <p className="rounded border border-[var(--border)] p-3 text-sm text-[var(--text-secondary)]">
          Додайте номенклатуру з фактичних позитивних залишків відправника.
        </p>
      ) : null}
      {lines.map((line, index) => {
        const current = balances.find((item) => item.inventoryItem.id === line.inventoryItemId);
        const options = balances.filter(
          (item) => item.inventoryItem.id === line.inventoryItemId || !selectedIds.includes(item.inventoryItem.id),
        );
        return (
          <div className="grid gap-2 rounded border border-[var(--border)] bg-[var(--surface-muted)] p-2 md:grid-cols-[minmax(220px,1fr)_110px_1fr_auto]" key={`${line.inventoryItemId}-${index}`}>
            <select className="input" value={line.inventoryItemId} onChange={(event) => updateLine(index, { inventoryItemId: event.target.value })}>
              {options.map((balance) => (
                <option key={balance.inventoryItem.id} value={balance.inventoryItem.id}>
                  {balance.inventoryItem.externalCode} · {balance.inventoryItem.name} · залишок {balance.quantity} {balance.inventoryItem.unitOfMeasure ?? ''}
                </option>
              ))}
            </select>
            <input
              className="input"
              min="0"
              max={current?.quantity}
              placeholder="Кількість"
              step="any"
              type="number"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
            />
            <input className="input" placeholder="Примітка до позиції" value={line.note} onChange={(event) => updateLine(index, { note: event.target.value })} />
            <button className="btn btn-danger !w-auto" type="button" onClick={() => onChange(lines.filter((_, currentIndex) => currentIndex !== index))}>
              Видалити
            </button>
          </div>
        );
      })}
      <p className="text-xs text-[var(--text-secondary)]">
        Позицій: {lines.length}. Загальна кількість: {lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)}
      </p>
    </div>
  );
}
