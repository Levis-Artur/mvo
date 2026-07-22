'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/ui/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  Card,
  ErrorState,
  FilterBar,
  Input,
  LoadingState,
  Pagination,
  Select,
  StatusBadge,
} from '@/components/ui';
import { StockDocumentDetailsModal } from '@/features/stock-documents/stock-document-details-modal';
import type { InventoryItemCardDocument, InventoryMovementCategory } from '@/lib/types';
import { inventoryDocumentHref } from './inventory-item-card-model';
import {
  InventoryBalancesTable,
  InventoryDocumentsTable,
  InventoryMovementsTable,
} from './inventory-item-card-tables';
import { formatQuantity } from './quantity-format';
import { useInventoryItemCard } from './use-inventory-item-card';

type CardTab = 'balances' | 'movements' | 'documents';

export function InventoryItemAccountingCardView({
  inventoryItemId,
  onBack,
}: {
  inventoryItemId: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const controller = useInventoryItemCard(inventoryItemId);
  const [tab, setTab] = useState<CardTab>('balances');
  const item = controller.card?.inventoryItem;

  function openDocument(document: InventoryItemCardDocument) {
    const href = inventoryDocumentHref(document);
    if (href) {
      router.push(href);
      return;
    }
    void controller.openStockDocument(document.id);
  }

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={onBack}>
              До номенклатури
            </Button>
            <Button
              disabled={controller.loading}
              icon="refresh"
              variant="outline"
              type="button"
              onClick={() => void controller.load()}
            >
              Оновити
            </Button>
          </div>
        }
        description={
          item
            ? `${item.name} · ${item.unitOfMeasure ?? 'одиницю не вказано'}`
            : 'Поточні залишки та повна історія руху позиції.'
        }
        icon="box"
        title={item ? `Картка номенклатури: ${item.externalCode}` : 'Картка номенклатури'}
      />

      {controller.error ? <ErrorState message={controller.error} /> : null}
      {controller.actionError ? <ErrorState message={controller.actionError} /> : null}
      {controller.loading && !controller.card ? (
        <LoadingState label="Завантаження картки номенклатури…" />
      ) : null}

      {item && controller.card ? (
        <>
          <Card title="Номенклатурна позиція">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Detail label="Код" value={item.externalCode} />
              <Detail label="Назва" value={item.name} />
              <Detail label="Одиниця виміру" value={item.unitOfMeasure ?? '—'} />
              <Detail
                label="Активність"
                value={
                  <StatusBadge tone={item.isActive ? 'success' : 'neutral'}>
                    {item.isActive ? 'Активна' : 'Архівна'}
                  </StatusBadge>
                }
              />
              <Detail
                label="Перевірка"
                value={
                  <StatusBadge
                    tone={item.reviewStatus === 'NEEDS_REVIEW' ? 'warning' : 'success'}
                  >
                    {item.reviewStatus === 'NEEDS_REVIEW'
                      ? 'Потребує перевірки'
                      : 'Перевірено'}
                  </StatusBadge>
                }
              />
            </dl>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Поточний залишок"
              value={formatQuantity(controller.card.totals.currentQuantity)}
            />
            <SummaryCard
              label="МВО із позитивним залишком"
              value={String(controller.card.totals.responsiblePersons)}
            />
          </div>

          <nav
            aria-label="Розділи картки номенклатури"
            className="flex flex-wrap gap-2"
          >
            <TabButton
              active={tab === 'balances'}
              label="Залишки по МВО"
              onClick={() => setTab('balances')}
            />
            <TabButton
              active={tab === 'movements'}
              label="Історія руху"
              onClick={() => setTab('movements')}
            />
            <TabButton
              active={tab === 'documents'}
              label="Документи"
              onClick={() => setTab('documents')}
            />
          </nav>

          {tab === 'balances' ? (
            <InventoryBalancesTable card={controller.card} loading={controller.loading} />
          ) : null}

          {tab === 'movements' ? (
            <>
              <FilterBar
                dateFrom={controller.draftFilters.dateFrom}
                dateTo={controller.draftFilters.dateTo}
                loading={controller.loading}
                onApply={controller.applyFilters}
                onDateFromChange={(dateFrom) =>
                  controller.setDraftFilters((current) => ({ ...current, dateFrom }))
                }
                onDateToChange={(dateTo) =>
                  controller.setDraftFilters((current) => ({ ...current, dateTo }))
                }
                onRefresh={() => void controller.load()}
                onReset={controller.resetFilters}
              >
                <FilterField label="Тип операції">
                  <Select
                    value={controller.draftFilters.movementType ?? ''}
                    onChange={(event) =>
                      controller.setDraftFilters((current) => ({
                        ...current,
                        movementType:
                          (event.target.value as InventoryMovementCategory) || undefined,
                      }))
                    }
                  >
                    <option value="">Усі операції</option>
                    <option value="IMPORT">Прихід за CSV</option>
                    <option value="MANUAL_RECEIPT">Ручний прихід</option>
                    <option value="MVO_TRANSFER">Передача між МВО</option>
                    <option value="ISSUE">Видача</option>
                    <option value="MVO_TRANSFER_REVERSAL">Скасування передачі</option>
                    <option value="ISSUE_REVERSAL">Скасування видачі</option>
                    <option value="LEGACY">Стара операція</option>
                  </Select>
                </FilterField>
                <FilterField label="МВО">
                  <Select
                    value={controller.draftFilters.responsiblePersonId ?? ''}
                    onChange={(event) =>
                      controller.setDraftFilters((current) => ({
                        ...current,
                        responsiblePersonId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Усі МВО</option>
                    {controller.persons.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.personnelNumber} — {person.lastName} {person.firstName}{' '}
                        {person.middleName ?? ''}
                      </option>
                    ))}
                  </Select>
                </FilterField>
                <FilterField label="Номер документа">
                  <Input
                    maxLength={100}
                    value={controller.draftFilters.documentNumber ?? ''}
                    onChange={(event) =>
                      controller.setDraftFilters((current) => ({
                        ...current,
                        documentNumber: event.target.value,
                      }))
                    }
                  />
                </FilterField>
                <Button
                  disabled={controller.exporting}
                  variant="outline"
                  type="button"
                  onClick={() => void controller.exportHistory()}
                >
                  {controller.exporting ? 'Експорт…' : 'Експортувати історію CSV'}
                </Button>
              </FilterBar>
              {controller.personsError ? (
                <div className="ui-alert" data-tone="warning" role="status">
                  Не вдалося завантажити список МВО для фільтра: {controller.personsError}
                </div>
              ) : null}
              <InventoryMovementsTable card={controller.card} loading={controller.loading} />
              <Pagination
                limit={controller.card.movements.pagination.limit}
                page={controller.card.movements.pagination.page}
                total={controller.card.movements.pagination.total}
                totalPages={controller.card.movements.pagination.totalPages}
                onLimitChange={(limit) => {
                  controller.setMovementLimit(limit);
                  controller.setMovementPage(1);
                }}
                onPage={controller.setMovementPage}
              />
            </>
          ) : null}

          {tab === 'documents' ? (
            <>
              <InventoryDocumentsTable
                card={controller.card}
                loading={controller.loading}
                opening={controller.documentLoading}
                onOpen={openDocument}
              />
              <Pagination
                limit={controller.card.documents.pagination.limit}
                page={controller.card.documents.pagination.page}
                total={controller.card.documents.pagination.total}
                totalPages={controller.card.documents.pagination.totalPages}
                onLimitChange={(limit) => {
                  controller.setDocumentLimit(limit);
                  controller.setDocumentPage(1);
                }}
                onPage={controller.setDocumentPage}
              />
            </>
          ) : null}
        </>
      ) : null}

      {controller.selectedDocument && user ? (
        <StockDocumentDetailsModal
          document={controller.selectedDocument}
          error=""
          loading={false}
          readOnly
          user={user}
          onCancel={() => undefined}
          onClose={() => controller.setSelectedDocument(null)}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onPost={() => undefined}
        />
      ) : null}
    </section>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-current={active ? 'page' : undefined}
      variant={active ? 'primary' : 'outline'}
      type="button"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="filter-bar__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card title={label}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}
