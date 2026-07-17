'use client';

import type {
  InventoryItem,
  Management,
  ResponsiblePerson,
  Service,
  Unit,
} from '@/lib/types';
import { Checkbox, FilterBar, Select } from '@/components/ui';
import type { StockFilterDraft } from './stock-model';

export function StockFilterBar({
  filters,
  loading,
  managements,
  services,
  units,
  persons,
  items,
  hideResponsiblePerson = false,
  onChange,
  onApply,
  onReset,
  onRefresh,
}: {
  filters: StockFilterDraft;
  loading: boolean;
  managements: Management[];
  services: Service[];
  units: Unit[];
  persons: ResponsiblePerson[];
  items: InventoryItem[];
  hideResponsiblePerson?: boolean;
  onChange: (filters: StockFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  onRefresh: () => void;
}) {
  const visibleServices = filters.managementId
    ? services.filter((service) => service.managementId === filters.managementId)
    : services;
  const visibleUnits = filters.serviceId
    ? units.filter((unit) => unit.serviceId === filters.serviceId)
    : units;
  const visiblePersons = persons.filter(
    (person) =>
      (!filters.managementId || person.managementId === filters.managementId) &&
      (!filters.serviceId || person.serviceId === filters.serviceId) &&
      (!filters.unitId || person.unitId === filters.unitId),
  );

  return (
    <FilterBar
      loading={loading}
      search={filters.search ?? ''}
      onApply={onApply}
      onRefresh={onRefresh}
      onReset={onReset}
      onSearchChange={(search) => onChange({ ...filters, search })}
    >
      {!hideResponsiblePerson ? (
        <>
          <FilterSelect
            label="Управління"
            value={filters.managementId ?? ''}
            onChange={(managementId) =>
              onChange({
                ...filters,
                managementId: managementId || undefined,
                serviceId: undefined,
                unitId: undefined,
                responsiblePersonId: undefined,
              })
            }
          >
            <option value="">Усі управління</option>
            {managements.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Служба"
            value={filters.serviceId ?? ''}
            onChange={(serviceId) =>
              onChange({
                ...filters,
                serviceId: serviceId || undefined,
                unitId: undefined,
                responsiblePersonId: undefined,
              })
            }
          >
            <option value="">Усі служби</option>
            {visibleServices.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Підрозділ"
            value={filters.unitId ?? ''}
            onChange={(unitId) =>
              onChange({
                ...filters,
                unitId: unitId || undefined,
                responsiblePersonId: undefined,
              })
            }
          >
            <option value="">Усі підрозділи</option>
            {visibleUnits.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="МВО"
            value={filters.responsiblePersonId ?? ''}
            onChange={(responsiblePersonId) =>
              onChange({
                ...filters,
                responsiblePersonId: responsiblePersonId || undefined,
              })
            }
          >
            <option value="">Усі МВО</option>
            {visiblePersons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.personnelNumber} — {person.lastName} {person.firstName}
              </option>
            ))}
          </FilterSelect>
        </>
      ) : null}
      <FilterSelect
        label="Номенклатура"
        value={filters.inventoryItemId ?? ''}
        onChange={(inventoryItemId) =>
          onChange({
            ...filters,
            inventoryItemId: inventoryItemId || undefined,
          })
        }
      >
        <option value="">Уся номенклатура</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.externalCode} — {item.name}
          </option>
        ))}
      </FilterSelect>
      <div className="grid min-w-48 gap-1">
        <Checkbox
          checked={Boolean(filters.onlyPositive)}
          label="Тільки позитивні"
          onChange={(event) =>
            onChange({
              ...filters,
              onlyPositive: event.target.checked,
              onlyProblematic: event.target.checked
                ? false
                : filters.onlyProblematic,
            })
          }
        />
        <Checkbox
          checked={Boolean(filters.onlyProblematic)}
          label="Тільки проблемні"
          onChange={(event) =>
            onChange({
              ...filters,
              onlyProblematic: event.target.checked,
              onlyPositive: event.target.checked ? false : filters.onlyPositive,
            })
          }
        />
      </div>
    </FilterBar>
  );
}

function FilterSelect({
  label,
  value,
  children,
  onChange,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-bar__field">
      <span>{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </Select>
    </label>
  );
}
