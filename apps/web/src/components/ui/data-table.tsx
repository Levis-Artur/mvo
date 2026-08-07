'use client';
import { EmptyState } from './empty-state';
import { LoadingState } from './loading-state';
import { resolveDataTableState } from './data-table-model';

export type TableAlign = 'left' | 'center' | 'right';
export type DataTableScrollMode = 'natural' | 'horizontal' | 'bounded';
export type DataTableResponsiveMode = 'table' | 'cards' | 'cards-wide';
export type DataTableColumn = {
  label: string;
  align?: TableAlign;
  numeric?: boolean;
  actions?: boolean;
  className?: string;
};

export function DataTable({ ariaLabel, columns, headers, rows, rowKeys, loading = false, emptyMessage = 'Дані відсутні.', selectedIndex, tableClassName = '', scrollMode = 'natural', responsiveMode = 'table', onRowClick }: {
  ariaLabel: string; columns?: DataTableColumn[]; headers?: string[]; rows: React.ReactNode[][];
  rowKeys?: React.Key[];
  loading?: boolean; emptyMessage?: string; selectedIndex?: number; tableClassName?: string;
  scrollMode?: DataTableScrollMode;
  responsiveMode?: DataTableResponsiveMode;
  onRowClick?: (index: number) => void;
}) {
  const normalizedColumns: DataTableColumn[] = columns ?? (headers ?? []).map((label) => ({ label }));
  const state = resolveDataTableState(loading, rows.length);
  if (state === 'loading') return <div className="data-table-state"><LoadingState label="Завантаження таблиці…" /></div>;
  if (state === 'empty') return <div className="data-table-state"><EmptyState message={emptyMessage} /></div>;
  const columnClassName = (column?: DataTableColumn) => [
    column?.numeric || column?.align === 'right' ? 'text-right tabular-nums' : '',
    column?.align === 'center' ? 'text-center' : '',
    column?.actions ? 'data-table__actions' : '',
    column?.className ?? '',
  ].filter(Boolean).join(' ');
  return <div className="data-table-shell"><div className={`${scrollMode === 'natural' ? '' : 'compact-scrollbar '}data-table-scroll`} data-scroll-mode={scrollMode}><table aria-label={ariaLabel} className={`data-table ${tableClassName}`} data-responsive={responsiveMode}><thead><tr>{normalizedColumns.map((column) => <th className={columnClassName(column)} key={column.label} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr aria-selected={selectedIndex === index ? 'true' : undefined} className={onRowClick ? 'data-table__interactive' : undefined} key={rowKeys?.[index] ?? index} onClick={() => onRowClick?.(index)} onKeyDown={(event) => { if (onRowClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(index); } }} tabIndex={onRowClick ? 0 : undefined}>{row.map((cell, cellIndex) => <td className={columnClassName(normalizedColumns[cellIndex])} data-label={normalizedColumns[cellIndex]?.label} key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div><footer className="data-table__footer">Записів у таблиці: {rows.length}</footer></div>;
}
