import type { ImportBatch } from '@/lib/types';
import { Button, DataTable } from '@/components/ui';
import { importTypeLabel } from '@/components/common';
import { ImportStatusBadge } from './import-status-badge';

export function ImportsTable({ imports, loading, onOpen, compact = false }: {
  imports: ImportBatch[];
  loading: boolean;
  onOpen: (batch: ImportBatch) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <DataTable
        ariaLabel="Історія завантажених відомостей"
        columns={[
          { label: 'Дата' },
          { label: 'Файл' },
          { label: 'Рядків', numeric: true },
          { label: 'Статус' },
          { label: 'Автор' },
          { label: 'Дія', actions: true },
        ]}
        emptyMessage="Відомості ще не завантажувалися."
        loading={loading}
        responsiveMode="cards-wide"
        rows={imports.map((batch) => [
          new Date(batch.createdAt).toLocaleString('uk-UA'),
          <Button className="accounting-imports__filename" key="file" variant="link" type="button" onClick={() => onOpen(batch)}>{batch.originalFilename}</Button>,
          batch.totalRows,
          <ImportStatusBadge key="status" status={batch.status} />,
          batch.uploadedByUser?.username ?? 'Невідомо',
          <Button key="actions" size="compact" variant="outline" type="button" onClick={() => onOpen(batch)}>Переглянути</Button>,
        ])}
      />
    );
  }

  return (
    <DataTable
      ariaLabel="Список завантажених імпортів"
      columns={[
        { label: 'Дата і час' },
        { label: 'Ім’я файла' },
        { label: 'Хто завантажив' },
        { label: 'Рядків', numeric: true },
        { label: 'Успішно', numeric: true },
        { label: 'Помилки', numeric: true },
        { label: 'Статус' },
        { label: 'Дії', actions: true },
      ]}
      emptyMessage="Імпорти ще не завантажувалися."
      loading={loading}
      responsiveMode="cards-wide"
      scrollMode="horizontal"
      rows={imports.map((batch) => [
        new Date(batch.createdAt).toLocaleString('uk-UA'),
        <Button className="max-w-72 break-all" key="file" title={importTypeLabel(batch.type)} variant="link" type="button" onClick={() => onOpen(batch)}>{batch.originalFilename}</Button>,
        batch.uploadedByUser?.username ?? 'Невідомо',
        batch.totalRows,
        batch.importedRows || batch.validRows + batch.warningRows,
        batch.errorRows,
        <ImportStatusBadge key="status" status={batch.status} />,
        <Button key="actions" variant="ghost" type="button" onClick={() => onOpen(batch)}>Переглянути</Button>,
      ])}
    />
  );
}
