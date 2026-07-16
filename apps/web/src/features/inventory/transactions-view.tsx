'use client';

import { useCallback, useEffect, useState } from 'react';
import { inventoryService as apiClient } from './inventory.service';
import type { StockTransaction } from '@/lib/types';
import { ErrorMessage, PageHeader, PaginationControls, SimpleTable, getErrorMessage } from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';

export function TransactionsView() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiClient.stockTransactions({
        page: pagination.page,
        limit: pagination.limit,
      });
      setTransactions(response.items);
      setPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'transactions') return;

      if (detail.action === 'refresh') {
        void load();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Р–СѓСЂРЅР°Р» РѕРїРµСЂР°С†С–Р№"
        description="РћРїРµСЂР°С†С–С— С–Р· Р·Р°Р»РёС€РєР°РјРё РґРѕСЃС‚СѓРїРЅС– Р»РёС€Рµ РґР»СЏ РїРµСЂРµРіР»СЏРґСѓ."
      />
      {error ? <ErrorMessage message={error} /> : null}
      <SimpleTable
        headers={[
          'Р”Р°С‚Р°',
          'РўРёРї',
          'РњР’Рћ',
          'РџРѕР·РёС†С–СЏ',
          'РљС–Р»СЊРєС–СЃС‚СЊ',
          'Р‘СѓР»Рѕ',
          'РЎС‚Р°Р»Рѕ',
          'Р”Р¶РµСЂРµР»Рѕ',
        ]}
        rows={transactions.map((item) => [
          new Date(item.occurredAt).toLocaleDateString('uk-UA'),
          item.type,
          item.responsiblePerson.fullName,
          item.inventoryItem.name,
          item.quantity,
          item.balanceBefore,
          item.balanceAfter,
          item.sourceDocument ?? '-',
        ])}
      />
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={(page) => setPagination((current) => ({ ...current, page }))}
      />
    </section>
  );
}


