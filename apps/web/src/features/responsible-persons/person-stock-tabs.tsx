'use client';

import { useEffect, useState } from 'react';
import { Button, Card, DataTable, ErrorState, StatusBadge } from '@/components/ui';
import { getErrorMessage } from '@/components/common';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { transactionTypeLabel } from '@/features/inventory/transaction-model';
import { documentNumberLabel } from '@/features/stock-documents/stock-document-rules';
import { StockDocumentStatusBadge } from '@/features/stock-documents/stock-document-status-badge';
import type {
  AccountingCardDocument,
  ResponsiblePersonAccountingCard,
  StockTransaction,
} from '@/lib/types';
import { responsiblePersonsService as apiClient } from './responsible-persons.service';

type PersonStockSection = 'direct' | 'legacy';

export function PersonStockTab({
  personId,
  onPresenceResolved,
}: {
  personId: string;
  onPresenceResolved?: (hasStock: boolean) => void;
}) {
  const [card, setCard] = useState<ResponsiblePersonAccountingCard | null>(null);
  const [section, setSection] = useState<PersonStockSection>('direct');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiClient
      .responsiblePersonAccountingCard(personId)
      .then((result) => {
        if (!active) return;
        setCard(result);
        onPresenceResolved?.(
          result.directBalances.length > 0 || result.legacyCustodyArchive.length > 0,
        );
      })
      .catch((reason: unknown) => {
        if (active) setError(getErrorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onPresenceResolved, personId]);

  if (error) return <ErrorState message={error} />;

  const rows = !card
    ? []
    : section === 'direct'
      ? card.directBalances.map((balance) => [
          balance.inventoryItem.externalCode,
          balance.inventoryItem.name,
          formatQuantity(balance.quantity),
        ])
      : card.legacyCustodyArchive.map((balance) => [
          balance.inventoryItem.externalCode,
          balance.inventoryItem.name,
          balance.accountingOwner.fullName,
          balance.custodian.fullName,
          formatQuantity(balance.quantity),
        ]);

  return (
    <div className="grid gap-3">
      {card ? (
        <Card title="Поточний прямий залишок">
          <strong className="text-xl tabular-nums">
            {formatQuantity(card.totalDirectQuantity)}
          </strong>
        </Card>
      ) : null}
      <nav aria-label="Дані обліку МВО" className="flex flex-wrap gap-2">
        <SectionButton
          active={section === 'direct'}
          onClick={() => setSection('direct')}
        >
          Поточні залишки
        </SectionButton>
        <SectionButton
          active={section === 'legacy'}
          onClick={() => setSection('legacy')}
        >
          Архів старої моделі
        </SectionButton>
      </nav>
      {section === 'direct' ? (
        <DataTable
          ariaLabel="Поточні прямі залишки МВО"
          columns={[
            { label: 'Код' },
            { label: 'Номенклатура' },
            { label: 'Кількість', numeric: true },
          ]}
          emptyMessage="Поточних залишків немає."
          loading={loading}
          rows={rows}
        />
      ) : (
        <>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Дані збережені лише для аудиту документів, проведених за старою моделлю.
          </p>
          <DataTable
            ariaLabel="Архів старої моделі обліку"
            columns={[
              { label: 'Код' },
              { label: 'Номенклатура' },
              { label: 'Колишній обліковий власник' },
              { label: 'Колишній утримувач' },
              { label: 'Архівна кількість', numeric: true },
            ]}
            emptyMessage="Архівних записів старої моделі немає."
            loading={loading}
            rows={rows}
          />
        </>
      )}
    </div>
  );
}

function SectionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      aria-current={active ? 'page' : undefined}
      variant={active ? 'primary' : 'outline'}
      type="button"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function PersonOperationsTab({ personId }: { personId: string }) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .getResponsiblePersonStockTransactions(personId, { limit: 50 })
      .then((response) => setTransactions(response.items))
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId]);

  if (error) return <ErrorState message={error} />;
  return (
    <DataTable
      ariaLabel="Останні операції МВО"
      columns={[
        { label: 'Дата' },
        { label: 'Тип' },
        { label: 'Позиція' },
        { label: 'Кількість', numeric: true },
        { label: 'Було', numeric: true },
        { label: 'Стало', numeric: true },
        { label: 'Джерело' },
      ]}
      emptyMessage="Операцій не знайдено."
      loading={loading}
      rows={transactions.map((transaction) => [
        new Date(transaction.occurredAt).toLocaleDateString('uk-UA'),
        transactionTypeLabel(transaction.type),
        transaction.inventoryItem.name,
        formatQuantity(transaction.quantity),
        formatQuantity(transaction.balanceBefore),
        formatQuantity(transaction.balanceAfter),
        transaction.sourceDocument ?? '—',
      ])}
    />
  );
}

export function PersonTransfersTab({ personId }: { personId: string }) {
  const [documents, setDocuments] = useState<AccountingCardDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .responsiblePersonAccountingCard(personId)
      .then((card) =>
        setDocuments(
          [...card.recentTransfers, ...card.recentIssues].sort((left, right) =>
            right.documentDate.localeCompare(left.documentDate),
          ),
        ),
      )
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [personId]);

  if (error) return <ErrorState message={error} />;
  return (
    <DataTable
      ariaLabel="Останні передачі та видачі МВО"
      columns={[
        { label: 'Номер' },
        { label: 'Дата' },
        { label: 'Тип' },
        { label: 'Відправник' },
        { label: 'Одержувач' },
        { label: 'Статус' },
      ]}
      emptyMessage="Передач і видач не знайдено."
      loading={loading}
      rows={documents.map((document) => [
        documentNumberLabel(document.displayNumber),
        new Date(document.documentDate).toLocaleDateString('uk-UA'),
        document.type === 'ISSUE' ? (
          <StatusBadge key="issue" tone="warning">
            Видача
          </StatusBadge>
        ) : (
          <StatusBadge
            key="transfer"
            tone={document.type === 'MVO_TRANSFER' ? 'info' : 'neutral'}
          >
            {document.type === 'MVO_TRANSFER' ? 'Передача' : 'Стара передача'}
          </StatusBadge>
        ),
        document.sourceResponsiblePerson.fullName,
        document.destinationResponsiblePerson?.fullName ?? 'Зовнішній одержувач',
        <StockDocumentStatusBadge key="status" status={document.status} />,
      ])}
    />
  );
}
