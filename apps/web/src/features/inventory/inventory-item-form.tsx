'use client';

import { FormEvent, useState } from 'react';
import type { InventoryItem } from '@/lib/types';
import { inventoryService as apiClient } from './inventory.service';
import { getErrorMessage } from '@/components/common';
import {
  Button,
  Checkbox,
  ErrorState,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';

export function InventoryItemForm({
  item,
  onClose,
  onSaved,
}: {
  item?: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    externalCode: item?.externalCode ?? '',
    name: item?.name ?? '',
    unitOfMeasure: item?.unitOfMeasure ?? '',
    category: item?.category ?? '',
    description: item?.description ?? '',
    reviewStatus:
      item?.reviewStatus ?? ('VERIFIED' as 'VERIFIED' | 'NEEDS_REVIEW'),
    isActive: item?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        unitOfMeasure: form.unitOfMeasure || null,
        category: form.category || null,
        description: form.description || null,
      };
      if (item) await apiClient.updateInventoryItem(item.id, payload);
      else await apiClient.createInventoryItem(payload);
      onSaved();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      closeOnEscape={!saving}
      footer={
        <>
          <Button disabled={saving} variant="outline" type="button" onClick={onClose}>
            Скасувати
          </Button>
          <Button disabled={saving} form="inventory-item-form" type="submit">
            {saving ? 'Збереження…' : 'Зберегти'}
          </Button>
        </>
      }
      onClose={onClose}
      size="large"
      title={item ? 'Редагувати номенклатуру' : 'Додати номенклатуру'}
    >
      <form className="grid gap-4" id="inventory-item-form" onSubmit={submit}>
        {error ? <ErrorState message={error} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Код" required>
            <Input
              value={form.externalCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  externalCode: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Найменування" required>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Одиниця виміру">
            <Input
              value={form.unitOfMeasure}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  unitOfMeasure: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Категорія">
            <Input
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
        <FormField label="Опис">
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </FormField>
        <FormField label="Статус перевірки">
          <Select
            value={form.reviewStatus}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                reviewStatus: event.target.value as
                  | 'VERIFIED'
                  | 'NEEDS_REVIEW',
              }))
            }
          >
            <option value="VERIFIED">Перевірена</option>
            <option value="NEEDS_REVIEW">Потребує перевірки</option>
          </Select>
        </FormField>
        <Checkbox
          checked={form.isActive}
          label="Активний запис"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              isActive: event.target.checked,
            }))
          }
        />
      </form>
    </Modal>
  );
}
