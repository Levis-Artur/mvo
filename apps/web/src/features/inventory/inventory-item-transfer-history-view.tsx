'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateTime, getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  LoadingState,
  Pagination,
  StatusBadge,
} from '@/components/ui';
import type { InventoryItemTransferHistory } from '@/lib/types';
import { inventoryService } from './inventory.service';
import { formatQuantity } from './quantity-format';

const PAGE_LIMIT = 25;

export function InventoryItemTransferHistoryView({
  inventoryItemId,
  onBack,
}: {
  inventoryItemId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<InventoryItemTransferHistory | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await inventoryService.inventoryItemTransferHistory(
        inventoryItemId,
        { page, limit: PAGE_LIMIT },
      );
      if (sequence === requestSequence.current) setData(response);
    } catch (reason) {
      if (sequence === requestSequence.current) {
        setError(getErrorMessage(reason));
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [inventoryItemId, page]);

  useEffect(() => {
    void load();
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  const inventoryItem = data?.inventoryItem;

  return (
    <section className="inventory-transfer-history grid min-w-0 gap-4">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onBack}>
              Назад
            </Button>
            <Button
              disabled={loading}
              icon="refresh"
              type="button"
              variant="outline"
              onClick={() => void load()}
            >
              Оновити
            </Button>
          </div>
        }
        description={
          inventoryItem
            ? `Одиниця виміру: ${inventoryItem.unit ?? '—'}`
            : 'Завантаження даних номенклатури…'
        }
        icon="box"
        title={
          inventoryItem
            ? `${inventoryItem.code} — ${inventoryItem.name}`
            : 'Картка номенклатури'
        }
      />

      {error ? (
        <div className="grid gap-2">
          <ErrorState message={error} />
          <div>
            <Button
              disabled={loading}
              type="button"
              variant="outline"
              onClick={() => void load()}
            >
              Повторити завантаження
            </Button>
          </div>
        </div>
      ) : null}

      {!data && loading ? (
        <LoadingState label="Завантаження історії передач…" />
      ) : null}

      {data ? (
        <Card title="Історія передач між МВО">
          <div className="grid min-w-0 gap-3">
            <DataTable
              ariaLabel="Історія передач номенклатури між МВО"
              columns={[
                { label: 'Дата' },
                { label: 'Документ' },
                { label: 'Відправник' },
                { label: 'Одержувач' },
                { label: 'Кількість', numeric: true },
                { label: 'Статус' },
              ]}
              emptyMessage="Цю позицію ще не передавали між МВО."
              loading={loading}
              responsiveMode="cards-wide"
              rows={data.items.map((item) => {
                const sender = `${item.sender.fullName} — код МВО ${item.sender.externalAccountingCode ?? 'не вказано'}`;
                const recipient = item.recipient
                  ? `${item.recipient.fullName} — код МВО ${item.recipient.externalAccountingCode ?? 'не вказано'}`
                  : 'Одержувача не вказано';
                return [
                  formatDateTime(item.documentDate),
                  `№ ${item.displayNumber}`,
                  <span
                    className="inventory-transfer-history__person"
                    key="sender"
                    title={sender}
                  >
                    {sender}
                  </span>,
                  <span
                    className="inventory-transfer-history__person"
                    key="recipient"
                    title={recipient}
                  >
                    {recipient}
                  </span>,
                  formatQuantity(item.quantity),
                  <StatusBadge
                    key="status"
                    tone={item.status === 'POSTED' ? 'success' : 'warning'}
                  >
                    {item.status === 'POSTED' ? 'Проведено' : 'Скасовано'}
                  </StatusBadge>,
                ];
              })}
              tableClassName="inventory-transfer-history__table"
            />
            <Pagination
              limit={data.pagination.limit}
              page={data.pagination.page}
              total={data.pagination.total}
              totalPages={data.pagination.totalPages}
              onPage={setPage}
            />
          </div>
        </Card>
      ) : null}
    </section>
  );
}
