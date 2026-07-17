import type { ImportRow } from '@/lib/types';
import { DataTable } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { ImportRowStatusBadge } from './import-status-badge';

const quantity = (value: string | null) => value === null ? '—' : formatQuantity(value);

export function ImportRowsTable({ rows, loading }: { rows: ImportRow[]; loading: boolean }) {
  return (
    <DataTable
      ariaLabel="Рядки імпортованого файлу"
      columns={[
        { label: '№', numeric: true }, { label: 'Контрагент' }, { label: 'МВО' },
        { label: 'Код' }, { label: 'Назва' }, { label: 'Одиниця' },
        { label: 'Кількість', numeric: true }, { label: 'Поточний', numeric: true },
        { label: 'Кінцевий у файлі', numeric: true }, { label: 'Розбіжність', numeric: true },
        { label: 'Статус' }, { label: 'Повідомлення' },
      ]}
      emptyMessage="Рядків за вказаними фільтрами не знайдено."
      loading={loading}
      rows={rows.map((row) => [
        row.rowNumber,
        <span className="block max-w-56 break-words" key="counterparty">{row.counterpartyRaw}</span>,
        row.responsiblePerson ? `${row.responsiblePerson.lastName} ${row.responsiblePerson.firstName}` : '—',
        <span className="font-mono" key="code">{row.nomenclatureCodeRaw}</span>,
        <span className="block max-w-64 break-words" key="name">{row.itemNameRaw}</span>,
        row.unitOfMeasureRaw ?? '—', quantity(row.parsedQuantity), quantity(row.systemBalance),
        quantity(row.fileEndingBalance), quantity(row.balanceDifference),
        <ImportRowStatusBadge key="status" status={row.status} />,
        row.message ? (
          <details className="max-w-64" key="message">
            <summary className="cursor-pointer font-semibold text-[var(--color-primary)]">Переглянути повідомлення</summary>
            <p className="mt-1 break-words whitespace-normal">{row.message}</p>
          </details>
        ) : '—',
      ])}
    />
  );
}
