'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  ErrorState,
  FormField,
  Input,
  Modal,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type { AvailableStockSource, StockDocumentType } from '@/lib/types';
import {
  filterStockSources,
  stockSourceKey,
} from './stock-source-picker-model';

export function StockSourcePickerModal({
  sources,
  selectedSourceKeys,
  type,
  loading,
  error,
  onRefresh,
  onConfirm,
  onClose,
}: {
  sources: AvailableStockSource[];
  selectedSourceKeys: string[];
  type: StockDocumentType;
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void> | void;
  onConfirm: (source: AvailableStockSource) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const options = useMemo(
    () => filterStockSources(sources, selectedSourceKeys, search, type),
    [search, selectedSourceKeys, sources, type],
  );
  const selected = options.find(
    (source) => stockSourceKey(source) === selectedKey,
  );

  useEffect(() => {
    if (
      selectedKey &&
      !options.some((source) => stockSourceKey(source) === selectedKey)
    ) {
      setSelectedKey('');
    }
  }, [options, selectedKey]);

  return (
    <Modal
      closeOnEscape={!loading}
      footer={
        <>
          <Button
            disabled={loading}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Скасувати
          </Button>
          <Button
            disabled={loading || !selected}
            type="button"
            onClick={() => selected && onConfirm(selected)}
          >
            Додати вибране
          </Button>
        </>
      }
      onClose={onClose}
      size="large"
      title="Вибір майна"
    >
      <div className="stock-source-picker">
        <div className="stock-source-picker__filters">
          <FormField label="Пошук">
            <Input
              autoFocus
              placeholder="Код або назва"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
          <Button
            disabled={loading}
            type="button"
            variant="outline"
            onClick={() => void onRefresh()}
          >
            Оновити список
          </Button>
        </div>

        {error ? <ErrorState message={error} /> : null}
        <DataTable
          ariaLabel="Доступне майно для додавання до документа"
          columns={[
            {
              label: 'Вибір',
              align: 'center',
              className: 'stock-source-picker__select',
            },
            { label: 'Код', className: 'stock-source-picker__code' },
            { label: 'Назва', className: 'stock-source-picker__name' },
            {
              label: 'Доступно',
              numeric: true,
              className: 'stock-source-picker__quantity',
            },
            { label: 'Одиниця' },
          ]}
          emptyMessage={
            search
              ? 'За вказаним запитом доступного майна не знайдено.'
              : 'Доступного майна немає або всі позиції вже додано до документа.'
          }
          loading={loading}
          rows={options.map((source) => {
            const key = stockSourceKey(source);
            return [
              <input
                aria-label={`Вибрати ${source.inventoryItem.name}`}
                checked={selectedKey === key}
                key="select"
                name="stock-source"
                type="radio"
                value={key}
                onChange={() => setSelectedKey(key)}
              />,
              source.inventoryItem.externalCode,
              <span className="stock-source-picker__name-text" key="name">
                {source.inventoryItem.name}
              </span>,
              formatQuantity(source.availableQuantity),
              source.inventoryItem.unitOfMeasure ?? '—',
            ];
          })}
          selectedIndex={options.findIndex(
            (source) => stockSourceKey(source) === selectedKey,
          )}
          tableClassName="stock-source-picker-table stock-source-picker-table--mvo"
          onRowClick={(index) =>
            setSelectedKey(stockSourceKey(options[index]))
          }
        />
      </div>
    </Modal>
  );
}
