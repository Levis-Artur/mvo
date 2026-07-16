'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { inventoryService as apiClient } from './inventory.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type { InventoryItem, ResponsiblePerson, StockBalance } from '@/lib/types';
import { ErrorMessage, Field, FormActions, Modal, PageHeader, PaginationControls, Select, SimpleTable, fullName, getErrorMessage } from '@/components/common';
import { focusFirstField, getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';

export function StockView() {
  const { user } = useAuth();
  const canWriteStock = can(user, 'write', 'stock');
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    responsiblePersonId: '',
    onlyPositive: true,
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [balanceResponse, personsResponse, itemsResponse] =
        await Promise.all([
          apiClient.stockBalances({
            ...filters,
            responsiblePersonId: filters.responsiblePersonId || undefined,
            page: pagination.page,
            limit: pagination.limit,
          }),
          apiClient.responsiblePersons({ limit: 100 }),
          apiClient.inventoryItems({ limit: 100 }),
        ]);
      setBalances(balanceResponse.items);
      setPagination(balanceResponse.pagination);
      setPersons(personsResponse.items);
      setItems(itemsResponse.items);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'stock') return;

      if (detail.action === 'focus-filter') {
        focusFirstField();
      }

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
        title="Р—Р°Р»РёС€РєРё"
        description="РџРѕС‚РѕС‡РЅС– Р·Р°Р»РёС€РєРё РјР°Р№РЅР° Р·Р° РњР’Рћ."
        action={
          canWriteStock ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setManualOpen(true)}
          >
            Р”РѕРґР°С‚Рё РЅР°РґС…РѕРґР¶РµРЅРЅСЏ РІСЂСѓС‡РЅСѓ
          </button>
          ) : undefined
        }
      />
      <div className="erp-toolbar p-2">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="input"
            placeholder="РџРѕС€СѓРє"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
          <Select
            value={filters.responsiblePersonId}
            onChange={(responsiblePersonId) =>
              setFilters((current) => ({ ...current, responsiblePersonId }))
            }
          >
            <option value="">РЈСЃС– РњР’Рћ</option>
            {persons.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={filters.onlyPositive}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  onlyPositive: event.target.checked,
                }))
              }
            />
            Р›РёС€Рµ РїРѕР·РёС‚РёРІРЅС– Р·Р°Р»РёС€РєРё
          </label>
        </div>
      </div>
      {error ? <ErrorMessage message={error} /> : null}
      <SimpleTable
        headers={['РњР’Рћ', 'РљРѕРґ', 'РќР°Р№РјРµРЅСѓРІР°РЅРЅСЏ', 'РћРґ.', 'Р—Р°Р»РёС€РѕРє', 'Р”С–С—']}
        rows={balances.map((balance) => [
          balance.responsiblePerson.fullName,
          balance.inventoryItem.externalCode,
          balance.inventoryItem.name,
          balance.inventoryItem.unitOfMeasure ?? '-',
          balance.quantity,
          'РџРµСЂРµРіР»СЏРЅСѓС‚Рё С–СЃС‚РѕСЂС–СЋ',
        ])}
      />
      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onPage={(page) => setPagination((current) => ({ ...current, page }))}
      />
      {manualOpen ? (
        <ManualReceiptForm
          persons={persons}
          items={items}
          onClose={() => setManualOpen(false)}
          onSaved={() => {
            setManualOpen(false);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

export function ManualReceiptForm({
  persons,
  items,
  onClose,
  onSaved,
}: {
  persons: ResponsiblePerson[];
  items: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    responsiblePersonId: '',
    inventoryItemId: '',
    quantity: '',
    occurredAt: new Date().toISOString().slice(0, 10),
    sourceDocument: '',
    comment: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.manualReceipt({
        ...form,
        sourceDocument: form.sourceDocument || undefined,
        comment: form.comment || undefined,
      });
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Р”РѕРґР°С‚Рё РЅР°РґС…РѕРґР¶РµРЅРЅСЏ РІСЂСѓС‡РЅСѓ" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {error ? <ErrorMessage message={error} /> : null}
        <Field label="РњР’Рћ">
          <Select
            required
            value={form.responsiblePersonId}
            onChange={(responsiblePersonId) =>
              setForm((current) => ({ ...current, responsiblePersonId }))
            }
          >
            <option value="">РћР±РµСЂС–С‚СЊ РњР’Рћ</option>
            {persons.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°">
          <Select
            required
            value={form.inventoryItemId}
            onChange={(inventoryItemId) =>
              setForm((current) => ({ ...current, inventoryItemId }))
            }
          >
            <option value="">РћР±РµСЂС–С‚СЊ РїРѕР·РёС†С–СЋ</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.externalCode} вЂ” {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="РљС–Р»СЊРєС–СЃС‚СЊ">
            <input
              required
              className="input"
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Р”Р°С‚Р°">
            <input
              required
              type="date"
              className="input"
              value={form.occurredAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  occurredAt: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Р”РѕРєСѓРјРµРЅС‚">
            <input
              className="input"
              value={form.sourceDocument}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceDocument: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="РљРѕРјРµРЅС‚Р°СЂ">
            <input
              className="input"
              value={form.comment}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  comment: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}


