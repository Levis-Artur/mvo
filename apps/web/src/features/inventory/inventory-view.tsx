'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { inventoryService as apiClient } from './inventory.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type { InventoryItem, InventoryItemsQuery } from '@/lib/types';
import { getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  ErrorState,
  FilterBar,
  Pagination,
  Select,
  Toast,
} from '@/components/ui';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { DestructiveActionModal } from '@/features/admin/destructive-action-modal';
import { canShowDestructiveActions } from '@/features/admin/destructive-actions';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';
import { InventoryItemForm } from './inventory-item-form';
import { InventoryItemAccountingCardView } from './inventory-item-accounting-card-view';
import { InventoryTable } from './inventory-table';
import {
  EMPTY_INVENTORY_FILTERS,
  inventoryQueryFromFilters,
  type InventoryFilterDraft,
} from './inventory-model';

const INITIAL_QUERY: InventoryItemsQuery = { page: 1, limit: 20 };

export function NomenclatureView({
  initialInventoryItemId,
}: {
  initialInventoryItemId?: string;
}) {
  const router = useRouter();
  if (initialInventoryItemId) {
    return (
      <InventoryItemAccountingCardView
        inventoryItemId={initialInventoryItemId}
        onBack={() => router.push('/nomenclature')}
      />
    );
  }
  return <NomenclatureListView />;
}

function NomenclatureListView() {
  const router = useRouter();
  const { user } = useAuth();
  const canWrite = can(user, 'write', 'nomenclature');
  const canDelete = canShowDestructiveActions(user?.role);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [query, setQuery] = useState<InventoryItemsQuery>(INITIAL_QUERY);
  const [draft, setDraft] = useState<InventoryFilterDraft>(
    EMPTY_INVENTORY_FILTERS,
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.inventoryItems(query);
      setItems(response.items);
      setPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'nomenclature') return;
      if (detail.action === 'create' && canWrite) {
        setEditingItem(null);
        setFormOpen(true);
      }
      if (detail.action === 'refresh') void load();
    }
    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [canWrite, load]);

  function openEdit(item: InventoryItem) {
    setEditingItem(item);
    setFormOpen(true);
  }

  async function toggleArchive(item: InventoryItem) {
    setError('');
    try {
      await apiClient.updateInventoryItem(item.id, { isActive: !item.isActive });
      await load();
      setToast(item.isActive ? 'Номенклатуру архівовано.' : 'Номенклатуру відновлено.');
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon="refresh" variant="outline" type="button" onClick={() => void load()}>
              Оновити
            </Button>
            {canWrite ? (
              <Button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setFormOpen(true);
                }}
              >
                Додати позицію
              </Button>
            ) : null}
          </div>
        }
        description="Централізований довідник позицій майна та їх обліковий стан."
        icon="box"
        title="Номенклатура"
      />

      <FilterBar
        loading={loading}
        search={draft.search}
        onApply={() =>
          setQuery(inventoryQueryFromFilters(draft, 1, pagination.limit))
        }
        onRefresh={() => void load()}
        onReset={() => {
          setDraft(EMPTY_INVENTORY_FILTERS);
          setQuery({ page: 1, limit: pagination.limit });
        }}
        onSearchChange={(search) => setDraft((current) => ({ ...current, search }))}
      >
        <label className="filter-bar__field">
          <span>Статус перевірки</span>
          <Select
            value={draft.reviewStatus}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                reviewStatus: event.target.value as InventoryFilterDraft['reviewStatus'],
              }))
            }
          >
            <option value="">Усі статуси</option>
            <option value="NEEDS_REVIEW">Потребують перевірки</option>
            <option value="VERIFIED">Перевірені</option>
          </Select>
        </label>
        <label className="filter-bar__field">
          <span>Активність</span>
          <Select
            value={draft.isActive}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                isActive: event.target.value as InventoryFilterDraft['isActive'],
              }))
            }
          >
            <option value="">Усі записи</option>
            <option value="true">Активні</option>
            <option value="false">Архівні</option>
          </Select>
        </label>
      </FilterBar>

      {error ? <ErrorState message={error} /> : null}
      <InventoryTable
        canDelete={canDelete}
        canEdit={canWrite}
        items={items}
        loading={loading}
        onDelete={setDeletingItem}
        onEdit={openEdit}
        onToggleArchive={(item) => void toggleArchive(item)}
        onView={(item) => router.push(`/inventory-items/${item.id}`)}
      />
      <Pagination
        limit={pagination.limit}
        page={pagination.page}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onLimitChange={(limit) => setQuery((current) => ({ ...current, limit, page: 1 }))}
        onPage={(page) => setQuery((current) => ({ ...current, page }))}
      />

      {formOpen ? (
        <InventoryItemForm
          item={editingItem}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void load();
          }}
        />
      ) : null}
      {deletingItem ? (
        <DestructiveActionModal
          entityId={deletingItem.id}
          entityType={ADMIN_ENTITY_TYPES.inventoryItem}
          onClose={() => setDeletingItem(null)}
          onDeleted={async () => {
            await load();
            setToast('Номенклатуру видалено.');
          }}
        />
      ) : null}
      {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </section>
  );
}
