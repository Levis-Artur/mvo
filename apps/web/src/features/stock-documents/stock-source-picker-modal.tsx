'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  ErrorState,
  FormField,
  Input,
  Modal,
  Select,
  StatusBadge,
} from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import type { AvailableStockSource, StockDocumentType } from '@/lib/types';
import {
  filterStockSources,
  stockSourceKey,
  stockSourceKindLabel,
  type StockSourceFilter,
} from './stock-source-picker-model';

export function StockSourcePickerModal({
  sources,
  selectedSourceKeys,
  type,
  loading,
  error,
  initialSourceBalanceId,
  onRefresh,
  onConfirm,
  onClose,
}: {
  sources: AvailableStockSource[];
  selectedSourceKeys: string[];
  type: StockDocumentType;
  loading: boolean;
  error: string;
  initialSourceBalanceId?: string;
  onRefresh: () => Promise<void> | void;
  onConfirm: (source: AvailableStockSource) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<StockSourceFilter>('ALL');
  const [selectedKey, setSelectedKey] = useState('');
  const options = useMemo(
    () => filterStockSources(sources, selectedSourceKeys, search, sourceFilter, type),
    [search, selectedSourceKeys, sourceFilter, sources, type],
  );
  const selected = options.find((source) => stockSourceKey(source) === selectedKey);

  useEffect(() => {
    if (selected || !initialSourceBalanceId) return;
    const initial = options.find((source) => source.sourceBalanceId === initialSourceBalanceId);
    if (initial) setSelectedKey(stockSourceKey(initial));
  }, [initialSourceBalanceId, options, selected]);

  useEffect(() => {
    if (selectedKey && !options.some((source) => stockSourceKey(source) === selectedKey)) {
      setSelectedKey('');
    }
  }, [options, selectedKey]);

  return <Modal
    closeOnEscape={!loading}
    footer={<>
      <Button disabled={loading} variant="outline" type="button" onClick={onClose}>Скасувати</Button>
      <Button disabled={loading || !selected} type="button" onClick={() => selected && onConfirm(selected)}>
        Додати вибране
      </Button>
    </>}
    onClose={onClose}
    size="large"
    title="Вибір майна"
  >
    <div className="stock-source-picker">
      <div className="stock-source-picker__filters">
        <FormField label="Пошук">
          <Input
            autoFocus
            placeholder="Код, назва або ПІБ облікового власника"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FormField>
        <FormField label="Тип джерела">
          <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as StockSourceFilter)}>
            <option value="ALL">Усі</option>
            <option value="DIRECT">Безпосередньо у мене</option>
            <option value="ASSIGNED">Закріплено за мною</option>
          </Select>
        </FormField>
        <Button disabled={loading} variant="outline" type="button" onClick={() => void onRefresh()}>
          Оновити список
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}
      <DataTable
        ariaLabel="Доступне майно для додавання до документа"
        columns={[
          { label: 'Вибір', align: 'center', className: 'stock-source-picker__select' },
          { label: 'Код', className: 'stock-source-picker__code' },
          { label: 'Назва', className: 'stock-source-picker__name' },
          { label: 'Доступно', numeric: true, className: 'stock-source-picker__quantity' },
          { label: 'Одиниця' },
          { label: 'Джерело', className: 'stock-source-picker__source' },
          { label: 'Обліковий власник', className: 'stock-source-picker__person' },
          { label: 'Поточний утримувач', className: 'stock-source-picker__person' },
        ]}
        emptyMessage={search || sourceFilter !== 'ALL'
          ? 'За вказаними умовами доступного майна не знайдено.'
          : 'Доступного майна немає або всі джерела вже додано до документа.'}
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
            <span className="stock-source-picker__name-text" key="name">{source.inventoryItem.name}</span>,
            formatQuantity(source.availableQuantity),
            source.inventoryItem.unitOfMeasure,
            <StatusBadge key="kind" tone={source.sourceKind === 'DIRECT' ? 'success' : 'info'}>
              {stockSourceKindLabel(source.sourceKind)}
            </StatusBadge>,
            source.accountingOwner.fullName,
            source.currentCustodian.fullName,
          ];
        })}
        selectedIndex={options.findIndex((source) => stockSourceKey(source) === selectedKey)}
        tableClassName="stock-source-picker-table"
        onRowClick={(index) => setSelectedKey(stockSourceKey(options[index]))}
      />
    </div>
  </Modal>;
}
