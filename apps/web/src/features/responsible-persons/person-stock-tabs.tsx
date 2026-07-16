'use client';

import { useEffect, useState } from 'react';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';
import type { StockBalance, StockTransaction } from '@/lib/types';
import {
  ErrorMessage,
  SimpleTable,
  getErrorMessage,
} from '@/components/common';
export function PersonStockTab({ personId }: { personId: string }) {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .getResponsiblePersonStockBalances(personId, { limit: 50 })
      .then((response) => setBalances(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [personId]);

  if (error) return <ErrorMessage message={error} />;

  return (
    <SimpleTable
      headers={['Код', 'Найменування', 'Кількість', 'Од.']}
      rows={balances.map((balance) => [
        balance.inventoryItem.externalCode,
        balance.inventoryItem.name,
        balance.quantity,
        balance.inventoryItem.unitOfMeasure ?? '-',
      ])}
    />
  );
}

export function PersonOperationsTab({ personId }: { personId: string }) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .getResponsiblePersonStockTransactions(personId, { limit: 50 })
      .then((response) => setTransactions(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [personId]);

  if (error) return <ErrorMessage message={error} />;

  return (
    <SimpleTable
      headers={[
        'Дата',
        'Тип',
        'Позиція',
        'Кількість',
        'Було',
        'Стало',
        'Джерело',
      ]}
      rows={transactions.map((transaction) => [
        new Date(transaction.occurredAt).toLocaleDateString('uk-UA'),
        transaction.type,
        transaction.inventoryItem.name,
        transaction.quantity,
        transaction.balanceBefore,
        transaction.balanceAfter,
        transaction.sourceDocument ?? '-',
      ])}
    />
  );
}



