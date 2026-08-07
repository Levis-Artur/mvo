'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDateTime, getErrorMessage } from '@/components/common';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  MetricCard,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { transactionTypeLabel } from '@/features/inventory/transaction-model';
import { ImportStatusBadge } from '@/features/imports/import-status-badge';
import type { AccountingOverview as AccountingOverviewData } from '@/lib/types';
import { accountingTransfersService } from './accounting-transfers.service';
import {
  operationDescription,
  operationDocumentLabel,
  operationPersonLabel,
} from './accounting-workspace-model';

export function AccountingOverview() {
  const [data, setData] = useState<AccountingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await accountingTransfersService.overview());
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <ErrorState message={error} />
        <Button icon="refresh" variant="outline" type="button" onClick={() => void load()}>
          Повторити
        </Button>
      </div>
    );
  }

  const operations = data?.recentOperations ?? [];

  return (
    <section aria-label="Огляд бухгалтерії" className="grid min-w-0 gap-4">
      <div className="flex justify-end">
        <Button disabled={loading} icon="refresh" variant="outline" type="button" onClick={() => void load()}>
          Оновити
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="people" label="Активні МВО" value={data?.metrics.activeResponsiblePersons ?? 0} />
        <MetricCard icon="box" label="Позиції номенклатури" value={data?.metrics.inventoryItems ?? 0} />
        <MetricCard icon="transfer" label="Передачі, не експортовані" tone="warning" value={data?.metrics.unexportedTransfers ?? 0} />
        <MetricCard icon="journal" label="Операції поточного місяця" value={data?.metrics.currentMonthTransactions ?? 0} />
      </div>
      <Card title="Останній імпорт">
        {loading ? <p>Завантаження…</p> : data?.lastImport ? (
          <dl className="detail-list">
            <div><dt>Файл</dt><dd>{data.lastImport.originalFilename}</dd></div>
            <div><dt>Статус</dt><dd><ImportStatusBadge status={data.lastImport.status} /></dd></div>
            <div><dt>Дата</dt><dd>{formatDateTime(data.lastImport.completedAt ?? data.lastImport.createdAt)}</dd></div>
          </dl>
        ) : <EmptyState message="Імпортів ще немає." />}
      </Card>
      <Card title="Останні операції">
        <DataTable
          ariaLabel="Останні операції з майном"
          columns={[
            { label: 'Дата' },
            { label: 'Тип' },
            { label: 'Документ' },
            { label: 'МВО' },
            { label: 'Опис' },
            { label: 'Кількість', numeric: true },
          ]}
          emptyMessage="Операцій ще немає."
          loading={loading}
          responsiveMode="cards-wide"
          rowKeys={operations.map((operation) => operation.id)}
          rows={operations.map((operation) => [
            formatDateTime(operation.occurredAt),
            transactionTypeLabel(operation.type),
            operationDocumentLabel(operation),
            operationPersonLabel(operation),
            operationDescription(operation),
            `${formatQuantity(operation.quantity)} ${operation.inventoryItem.unitOfMeasure ?? ''}`.trim(),
          ])}
        />
      </Card>
    </section>
  );
}
