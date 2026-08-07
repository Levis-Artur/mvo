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
        { label: '№ рядка', numeric: true },
        { label: 'Контрагент' },
        { label: 'Код МВО' },
        { label: 'МВО у системі' },
        { label: 'Код номенклатури' },
        { label: 'Назва' },
        { label: 'Кількість', numeric: true },
        { label: 'Статус' },
        { label: 'Помилка' },
      ]}
      emptyMessage="Рядків за вказаними фільтрами не знайдено."
      loading={loading}
      responsiveMode="cards-wide"
      scrollMode="horizontal"
      rows={rows.map((row) => [
        row.rowNumber,
        <span className="block max-w-56 break-words" key="counterparty">{row.counterpartyRaw}</span>,
        <span className="font-mono whitespace-nowrap" key="mvo-code">{row.externalAccountingCode ?? '—'}</span>,
        row.responsiblePerson
          ? [row.responsiblePerson.lastName, row.responsiblePerson.firstName, row.responsiblePerson.middleName].filter(Boolean).join(' ')
          : '—',
        <span className="font-mono" key="code">{row.nomenclatureCodeRaw}</span>,
        <span className="block max-w-64 break-words" key="name">{row.itemNameRaw}</span>,
        quantity(row.parsedQuantity),
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
