import type { ImportBatch } from '@/lib/types';
import { Button, DataTable } from '@/components/ui';
import { importTypeLabel } from '@/components/common';
import { ImportStatusBadge } from './import-status-badge';

export function ImportsTable({ imports, loading, onOpen }: {
  imports: ImportBatch[];
  loading: boolean;
  onOpen: (batch: ImportBatch) => void;
}) {
  return (
    <DataTable
      ariaLabel="Список завантажених імпортів"
      columns={[
        { label: 'Файл' }, { label: 'Тип' }, { label: 'Статус' },
        { label: 'Кодування' }, { label: 'Роздільник' },
        { label: 'Рядків', numeric: true }, { label: 'Валідні', numeric: true },
        { label: 'Попередження', numeric: true }, { label: 'Помилки', numeric: true },
        { label: 'Пропущені', numeric: true }, { label: 'Проведені', numeric: true },
        { label: 'Завантажено' }, { label: 'Користувач' }, { label: 'Дії', actions: true },
      ]}
      emptyMessage="Імпорти ще не завантажувалися."
      loading={loading}
      rows={imports.map((batch) => [
        <Button className="max-w-72 break-all" key="file" variant="link" type="button" onClick={() => onOpen(batch)}>{batch.originalFilename}</Button>,
        importTypeLabel(batch.type),
        <ImportStatusBadge key="status" status={batch.status} />,
        batch.encoding,
        batch.delimiter === 'tab' ? 'Табуляція' : batch.delimiter,
        batch.totalRows, batch.validRows, batch.warningRows, batch.errorRows,
        batch.skippedRows, batch.importedRows,
        new Date(batch.createdAt).toLocaleString('uk-UA'),
        <span key="user" title="Автор імпорту не повертається поточним API">Не надається API</span>,
        <Button key="actions" variant="ghost" type="button" onClick={() => onOpen(batch)}>Переглянути</Button>,
      ])}
    />
  );
}
