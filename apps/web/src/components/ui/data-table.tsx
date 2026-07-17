'use client';
import { EmptyState } from './empty-state';
import { LoadingState } from './loading-state';
import { resolveDataTableState } from './data-table-model';

export type TableAlign = 'left' | 'center' | 'right';
export type DataTableColumn = { label: string; align?: TableAlign; numeric?: boolean; actions?: boolean };

export function DataTable({ ariaLabel, columns, headers, rows, loading = false, emptyMessage = 'Дані відсутні.', selectedIndex, onRowClick }: {
  ariaLabel: string; columns?: DataTableColumn[]; headers?: string[]; rows: React.ReactNode[][];
  loading?: boolean; emptyMessage?: string; selectedIndex?: number; onRowClick?: (index: number) => void;
}) {
  const normalizedColumns: DataTableColumn[] = columns ?? (headers ?? []).map((label) => ({ label }));
  const state = resolveDataTableState(loading, rows.length);
  if (state === 'loading') return <div className="data-table-state"><LoadingState label="Завантаження таблиці…" /></div>;
  if (state === 'empty') return <div className="data-table-state"><EmptyState message={emptyMessage} /></div>;
  return <div className="data-table-shell"><div className="compact-scrollbar data-table-scroll">
    <table aria-label={ariaLabel} className="data-table"><thead><tr>{normalizedColumns.map((column) => (
      <th className={column.numeric || column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''} key={column.label} scope="col">{column.label}</th>
    ))}</tr></thead><tbody>{rows.map((row, index) => (
      <tr aria-selected={selectedIndex === index ? 'true' : undefined} className={onRowClick ? 'data-table__interactive' : undefined} key={index} onClick={() => onRowClick?.(index)} onKeyDown={(event) => {
        if (onRowClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(index); }
      }} tabIndex={onRowClick ? 0 : undefined}>
        {row.map((cell, cellIndex) => { const column = normalizedColumns[cellIndex]; return <td className={column?.numeric || column?.align === 'right' ? 'text-right tabular-nums' : column?.align === 'center' ? 'text-center' : column?.actions ? 'data-table__actions' : ''} key={cellIndex}>{cell}</td>; })}
      </tr>
    ))}</tbody></table>
  </div><footer className="data-table__footer">Записів у таблиці: {rows.length}</footer></div>;
}
