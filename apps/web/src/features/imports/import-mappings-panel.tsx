import type { ResponsiblePerson } from '@/lib/types';
import { Button, Card, Checkbox, Select } from '@/components/ui';
import { fullName } from '@/components/common';

type Mapping = { responsiblePersonId: string; save: boolean };

export function ImportMappingsPanel({ counterparties, persons, mappings, loading, onMappingsChange, onSave }: {
  counterparties: string[];
  persons: ResponsiblePerson[];
  mappings: Record<string, Mapping>;
  loading: boolean;
  onMappingsChange: (mappings: Record<string, Mapping>) => void;
  onSave: () => void;
}) {
  if (!counterparties.length) return null;
  return (
    <Card title="Зіставлення контрагентів із МВО">
      <div className="grid gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">Оберіть МВО для контрагентів, яких не знайдено автоматично.</p>
        {counterparties.map((counterparty) => (
          <div className="grid gap-2 border-t border-[var(--color-border-light)] pt-3 md:grid-cols-[1fr_1fr_auto]" key={counterparty}>
            <p className="break-words text-sm font-medium">{counterparty}</p>
            <Select aria-label={`МВО для ${counterparty}`} disabled={loading} value={mappings[counterparty]?.responsiblePersonId ?? ''} onChange={(event) => onMappingsChange({
              ...mappings,
              [counterparty]: { responsiblePersonId: event.target.value, save: mappings[counterparty]?.save ?? true },
            })}>
              <option value="">Оберіть МВО</option>
              {persons.map((person) => <option key={person.id} value={person.id}>{fullName(person)} — {person.personnelNumber}</option>)}
            </Select>
            <Checkbox checked={mappings[counterparty]?.save ?? true} disabled={loading} label="Зберегти" onChange={(event) => onMappingsChange({
              ...mappings,
              [counterparty]: {
                responsiblePersonId: mappings[counterparty]?.responsiblePersonId ?? '',
                save: event.target.checked,
              },
            })} />
          </div>
        ))}
        <Button className="w-fit" disabled={loading} type="button" onClick={onSave}>Зберегти зіставлення</Button>
      </div>
    </Card>
  );
}
