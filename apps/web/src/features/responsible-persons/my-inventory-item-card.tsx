'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMvoErrorMessage } from '@/components/common';
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
import { formatQuantity } from '@/features/inventory/quantity-format';
import type { MyInventoryItemTransferHistory } from '@/lib/types';
import { responsiblePersonsService } from './responsible-persons.service';

const PAGE_LIMIT = 25;

export function MyInventoryItemCard({
  inventoryItemId,
  onBack,
}: {
  inventoryItemId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<MyInventoryItemTransferHistory | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response =
        await responsiblePersonsService.myInventoryItemTransferHistory(
          inventoryItemId,
          { page, limit: PAGE_LIMIT },
        );
      if (sequence === requestSequence.current) setData(response);
    } catch (reason) {
      if (sequence === requestSequence.current) {
        setError(getMvoErrorMessage(reason));
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
    <section className="my-inventory-item-card grid min-w-0 gap-4">
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
            ? `Код: ${inventoryItem.code} · Одиниця: ${inventoryItem.unit ?? '—'} · Поточний залишок: ${formatQuantity(data.currentBalance)}`
            : 'Завантаження даних номенклатури…'
        }
        icon="box"
        title={inventoryItem?.name ?? 'Картка номенклатури'}
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
        <LoadingState label="Завантаження картки номенклатури…" />
      ) : null}

      {data ? (
        <Card title="Передачі іншим МВО">
          <div className="grid min-w-0 gap-3">
            <DataTable
              ariaLabel="Передачі цієї номенклатури іншим МВО"
              columns={[
                { label: 'Дата' },
                { label: 'Документ' },
                { label: 'Кому передано' },
                { label: 'Кількість', numeric: true },
                { label: 'Статус' },
              ]}
              emptyMessage="Цю позицію ще не передавали іншим МВО."
              loading={loading}
              responsiveMode="cards"
              rows={data.items.map((item) => {
                const recipient = item.recipient
                  ? `${item.recipient.externalAccountingCode ?? 'Не вказано'} — ${item.recipient.fullName}`
                  : 'Одержувача не вказано';
                return [
                  new Date(item.documentDate).toLocaleDateString('uk-UA'),
                  `№ ${item.displayNumber}`,
                  <span
                    className="my-inventory-item-card__person"
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
              tableClassName="my-inventory-item-card__table"
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
