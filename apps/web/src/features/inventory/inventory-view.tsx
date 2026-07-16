'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { inventoryService as apiClient } from './inventory.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type { InventoryItem } from '@/lib/types';
import { ErrorMessage, Field, FormActions, LoadingMessage, Modal, PageHeader, PaginationControls, Select, SimpleTable, getErrorMessage } from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';

export function NomenclatureView() {
  const { user } = useAuth();
  const canWriteNomenclature = can(user, 'write', 'nomenclature');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    reviewStatus: '',
    isActive: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.inventoryItems({
        search: filters.search,
        reviewStatus:
          filters.reviewStatus === ''
            ? undefined
            : (filters.reviewStatus as 'VERIFIED' | 'NEEDS_REVIEW'),
        isActive:
          filters.isActive === '' ? undefined : filters.isActive === 'true',
        page: pagination.page,
        limit: pagination.limit,
      });
      setItems(response.items);
      setPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'nomenclature') return;

      if (detail.action === 'create' && canWriteNomenclature) {
        setFormOpen(true);
      }

      if (detail.action === 'refresh') {
        void load();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [canWriteNomenclature, load]);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Номенклатура"
        description="Централізований довідник позицій майна."
        action={
          canWriteNomenclature ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setFormOpen(true)}
          >
            Додати позицію
          </button>
          ) : undefined
        }
      />
      <div className="erp-toolbar p-2">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="input"
            placeholder="Пошук за кодом або назвою"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
          <Select
            value={filters.reviewStatus}
            onChange={(reviewStatus) =>
              setFilters((current) => ({ ...current, reviewStatus }))
            }
          >
            <option value="">Усі статуси перевірки</option>
            <option value="NEEDS_REVIEW">Потребують перевірки</option>
            <option value="VERIFIED">Перевірені</option>
          </Select>
          <Select
            value={filters.isActive}
            onChange={(isActive) =>
              setFilters((current) => ({ ...current, isActive }))
            }
          >
            <option value="">Усі записи</option>
            <option value="true">Активні</option>
            <option value="false">Неактивні</option>
          </Select>
        </div>
      </div>
      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingMessage /> : null}
      {!loading ? (
        <SimpleTable
          headers={[
            'Код',
            'Найменування',
            'Од.',
            'Категорія',
            'Перевірка',
            'МВО',
            'Залишок',
          ]}
          rows={items.map((item) => [
            item.externalCode,
            item.name,
            item.unitOfMeasure ?? '-',
            item.category ?? '-',
            item.reviewStatus === 'NEEDS_REVIEW'
              ? 'Потребує перевірки'
              : 'Перевірено',
            String(item.responsiblePersonsCount ?? 0),
            item.totalQuantity ?? '0',
          ])}
        />
      ) : null}
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={(page) => setPagination((current) => ({ ...current, page }))}
      />
      {formOpen ? (
        <InventoryItemForm
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

export function InventoryItemForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    externalCode: '',
    name: '',
    unitOfMeasure: '',
    category: '',
    description: '',
    reviewStatus: 'VERIFIED' as 'VERIFIED' | 'NEEDS_REVIEW',
    isActive: true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.createInventoryItem({
        ...form,
        unitOfMeasure: form.unitOfMeasure || null,
        category: form.category || null,
        description: form.description || null,
      });
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Додати номенклатуру" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Зовнішній код">
            <input
              required
              className="input"
              value={form.externalCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  externalCode: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Найменування">
            <input
              required
              className="input"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
          <Field label="Одиниця виміру">
            <input
              className="input"
              value={form.unitOfMeasure}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  unitOfMeasure: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Категорія">
            <input
              className="input"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <Field label="Опис">
          <textarea
            className="input min-h-24"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Статус перевірки">
          <Select
            value={form.reviewStatus}
            onChange={(reviewStatus) =>
              setForm((current) => ({
                ...current,
                reviewStatus: reviewStatus as 'VERIFIED' | 'NEEDS_REVIEW',
              }))
            }
          >
            <option value="VERIFIED">Перевірено</option>
            <option value="NEEDS_REVIEW">Потребує перевірки</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isActive: event.target.checked,
              }))
            }
          />
          Активний запис
        </label>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}


