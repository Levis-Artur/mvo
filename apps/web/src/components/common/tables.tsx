'use client';
import { EmptyState } from './feedback';

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-h-16 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
      <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--primary)]">
        {value}
      </p>
    </div>
  );
}

export function SimpleTable({
  headers,
  rows,
  onRowClick,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  onRowClick?: (index: number) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState message="Р”Р°РЅС– РІС–РґСЃСѓС‚РЅС–." />;
  }

  return (
    <div className="erp-panel overflow-hidden">
      <div className="compact-scrollbar max-h-[560px] overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.map((cell) => String(cell)).join('-')}-${index}`}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(index)}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${String(cell)}-${cellIndex}`}
                    className="max-w-80 break-words"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--toolbar-background)] px-2 py-1 text-xs text-[var(--text-secondary)]">
        Р—Р°РїРёСЃС–РІ Сѓ С‚Р°Р±Р»РёС†С–: {rows.length}
      </div>
    </div>
  );
}

export function PaginationControls({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const canGoBack = page > 1;
  const canGoForward = totalPages > 0 && page < totalPages;

  return (
    <div className="erp-panel flex flex-col gap-2 bg-[var(--toolbar-background)] px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[var(--text-secondary)]">
        Р—Р°РїРёСЃС–РІ: {total}. РЎС‚РѕСЂС–РЅРєР° {page} Р· {totalPages || 1}
      </span>
      <div className="flex gap-2">
        <button
          className="btn btn-outline !w-auto"
          disabled={!canGoBack}
          type="button"
          onClick={() => onPage(page - 1)}
        >
          РќР°Р·Р°Рґ
        </button>
        <button
          className="btn btn-outline !w-auto"
          disabled={!canGoForward}
          type="button"
          onClick={() => onPage(page + 1)}
        >
          Р”Р°Р»С–
        </button>
      </div>
    </div>
  );
}


