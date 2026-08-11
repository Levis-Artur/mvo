'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { formatDateTime, getMvoErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  LoadingState,
  Pagination,
  StatusBadge,
  Toast,
} from '@/components/ui';
import {
  movementDisplayQuantity,
  movementTone,
} from '@/features/inventory/inventory-item-card-model';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { submitNewIssue } from '@/features/stock-documents/issue-submit';
import { submitNewMvoTransfer } from '@/features/stock-documents/mvo-transfer-submit';
import { StockDocumentForm } from '@/features/stock-documents/stock-document-form';
import { stockDocumentsService } from '@/features/stock-documents/stock-documents.service';
import { loadTransferTargets } from '@/features/stock-documents/transfer-targets';
import type {
  AvailableStockSource,
  MyInventoryItemMovementHistory,
  StockDocumentInput,
  StockDocumentType,
  TransferTarget,
} from '@/lib/types';
import { responsiblePersonsService } from './responsible-persons.service';

const PAGE_LIMIT = 25;

export function MyInventoryItemCard({
  inventoryItemId,
  onBack,
}: {
  inventoryItemId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<MyInventoryItemMovementHistory | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formType, setFormType] = useState<Extract<StockDocumentType, 'MVO_TRANSFER' | 'ISSUE'> | null>(null);
  const [availableSources, setAvailableSources] = useState<AvailableStockSource[]>([]);
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [sourcesError, setSourcesError] = useState('');
  const [targetsError, setTargetsError] = useState('');
  const [toast, setToast] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response =
        await responsiblePersonsService.myInventoryItemMovementHistory(
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

  async function loadItemSources(type: Extract<StockDocumentType, 'MVO_TRANSFER' | 'ISSUE'>) {
    const sources = await stockDocumentsService.availableToMe();
    const itemSources = sources.filter(
      (source) =>
        source.inventoryItem.id === inventoryItemId &&
        Number(source.availableQuantity) > 0 &&
        (type === 'MVO_TRANSFER' ? source.canTransfer : source.canIssue),
    );
    if (!itemSources.length) {
      throw new Error('Ця позиція не має доступного залишку для вибраної операції.');
    }
    setAvailableSources(itemSources);
    return itemSources;
  }

  async function openOperation(
    type: Extract<StockDocumentType, 'MVO_TRANSFER' | 'ISSUE'>,
  ) {
    if (!user || preparing) return;
    setPreparing(true);
    setFormError('');
    setSourcesError('');
    setTargetsError('');
    try {
      const sourcesPromise = loadItemSources(type);
      const targetsPromise =
        type === 'MVO_TRANSFER'
          ? loadTransferTargets(stockDocumentsService.transferTargets)
          : Promise.resolve([]);
      const [, targets] = await Promise.all([sourcesPromise, targetsPromise]);
      setTransferTargets(targets);
      setFormType(type);
    } catch (reason) {
      setToast(getMvoErrorMessage(reason));
    } finally {
      setPreparing(false);
    }
  }

  async function refreshSources() {
    if (!formType) return;
    setSourcesError('');
    try {
      await loadItemSources(formType);
    } catch (reason) {
      setSourcesError(getMvoErrorMessage(reason));
    }
  }

  async function submitOperation(input: StockDocumentInput, files: File[]) {
    if (!formType || saving) return;
    setSaving(true);
    setFormError('');
    try {
      if (formType === 'MVO_TRANSFER') {
        await submitNewMvoTransfer(
          input,
          stockDocumentsService.createAndPostMvoTransfer,
        );
        setToast('Передачу проведено. Залишки оновлено.');
      } else {
        await submitNewIssue(
          input,
          files,
          stockDocumentsService.createAndPostIssue,
        );
        setToast('Видачу проведено. Залишки оновлено.');
      }
      setFormType(null);
      setAvailableSources([]);
      setTransferTargets([]);
      setPage(1);
      if (page === 1) await load();
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-transactions'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-accounting-cards'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock-documents'));
    } catch (reason) {
      setFormError(getMvoErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const inventoryItem = data?.inventoryItem;
  const canOperate =
    user?.role === 'MVO' && Number(data?.currentBalance ?? 0) > 0;

  return (
    <section className="my-inventory-item-card grid min-w-0 gap-4">
      <PageHeader
        action={
          <div className="my-inventory-item-card__actions">
            <Button type="button" variant="outline" onClick={onBack}>
              Назад
            </Button>
            {user?.role === 'MVO' ? (
              <>
                <Button
                  disabled={!canOperate || preparing}
                  type="button"
                  onClick={() => void openOperation('MVO_TRANSFER')}
                >
                  Передати
                </Button>
                <Button
                  disabled={!canOperate || preparing}
                  type="button"
                  variant="outline"
                  onClick={() => void openOperation('ISSUE')}
                >
                  Видати
                </Button>
              </>
            ) : null}
            <Button
              disabled={loading || preparing}
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
        <Card title="Історія руху">
          <div className="grid min-w-0 gap-3">
            <DataTable
              ariaLabel="Історія руху номенклатури"
              columns={[
                {
                  label: 'Дата і час',
                  className: 'my-inventory-item-card__date',
                },
                {
                  label: 'Операція',
                  className: 'my-inventory-item-card__operation',
                },
                {
                  label: 'Кількість',
                  numeric: true,
                  className: 'my-inventory-item-card__quantity',
                },
                {
                  label: 'МВО-відправник',
                  className: 'my-inventory-item-card__sender',
                },
                {
                  label: 'МВО-отримувач / кому видано',
                  className: 'my-inventory-item-card__recipient',
                },
                {
                  label: 'Примітка / підстава',
                  className: 'my-inventory-item-card__note',
                },
                {
                  label: 'Користувач',
                  className: 'my-inventory-item-card__user',
                },
              ]}
              emptyMessage="Історії руху цієї позиції ще немає."
              loading={loading}
              responsiveMode="cards-wide"
              scrollMode="horizontal"
              rows={data.items.map((movement) => [
                formatDateTime(movement.occurredAt),
                <StatusBadge key="type" tone={movementTone(movement.category)}>
                  {movement.typeLabel}
                </StatusBadge>,
                formatMovementQuantity(movementDisplayQuantity(movement)),
                <MovementText key="sender" value={movement.from} />,
                <MovementText key="recipient" value={movement.to} />,
                <MovementText key="note" value={movement.note ?? '—'} />,
                <MovementText key="user" value={movement.user ?? '—'} />,
              ])}
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

      {formType && user ? (
        <StockDocumentForm
          availableSources={availableSources}
          error={formError}
          initialInventoryItemId={inventoryItemId}
          initialSourceId={user.responsiblePersonId ?? ''}
          loadingSources={false}
          loadingTargets={false}
          persons={[]}
          saving={saving}
          sourcesError={sourcesError}
          targetsError={targetsError}
          transferTargets={transferTargets}
          type={formType}
          user={user}
          onClose={() => {
            if (!saving) setFormType(null);
          }}
          onRemoveAttachment={async () => undefined}
          onSourceChange={() => refreshSources()}
          onSubmit={submitOperation}
        />
      ) : null}

      {toast ? (
        <Toast
          message={toast}
          tone={toast.includes('проведено') ? 'success' : 'error'}
          onClose={() => setToast('')}
        />
      ) : null}
    </section>
  );
}

function formatMovementQuantity(value: string) {
  return value.startsWith('+')
    ? `+${formatQuantity(value.slice(1))}`
    : formatQuantity(value);
}

function MovementText({ value }: { value: string }) {
  return (
    <span className="my-inventory-item-card__text" title={value}>
      {value}
    </span>
  );
}
