'use client';

import type { ResponsiblePerson } from '@/lib/types';
import {
  EmptyState,
  InfoRow,
  StatusBadge,
  fullName,
} from '@/components/common';
export function PersonsTable({
  persons,
  canEdit,
  canCreateAccount,
  onEdit,
  onCreateAccount,
}: {
  persons: ResponsiblePerson[];
  canEdit: boolean;
  canCreateAccount: boolean;
  onEdit: (person: ResponsiblePerson) => void;
  onCreateAccount: (person: ResponsiblePerson) => void;
}) {
  if (persons.length === 0) {
    return <EmptyState message="МВО не знайдено." />;
  }

  return (
    <div className="app-card overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="data-table">
          <thead>
            <tr>
              {[
                'ПІП',
                'Табельний номер',
                'Управління',
                'Служба',
                'Підрозділ',
                'Статус',
                'Дії',
              ].map((header) => (
                <th key={header} className="px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {persons.map((person) => (
              <tr key={person.id}>
                <td className="px-4 py-3 font-medium">{fullName(person)}</td>
                <td className="px-4 py-3">{person.personnelNumber}</td>
                <td className="max-w-64 px-4 py-3">{person.management.name}</td>
                <td className="px-4 py-3">{person.service.name}</td>
                <td className="px-4 py-3">{person.unit?.name ?? '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge active={person.isActive} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canEdit ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onEdit(person)}
                      >
                        Редагувати
                      </button>
                    ) : null}
                    {canCreateAccount ? (
                      <button
                        className="btn btn-ghost !min-h-0 !w-fit !p-0"
                        type="button"
                        onClick={() => onCreateAccount(person)}
                      >
                        Створити обліковий запис
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        {persons.map((person) => (
          <div
            key={person.id}
            className="rounded-md border border-slate-200 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold">{fullName(person)}</p>
                <p className="text-sm text-slate-500">
                  {person.personnelNumber}
                </p>
              </div>
              <StatusBadge active={person.isActive} />
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              <InfoRow label="Управління" value={person.management.name} />
              <InfoRow label="Служба" value={person.service.name} />
              <InfoRow label="Підрозділ" value={person.unit?.name ?? '-'} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {canEdit ? (
                <button
                  className="btn btn-ghost !min-h-0 !w-fit !p-0"
                  type="button"
                  onClick={() => onEdit(person)}
                >
                  Редагувати
                </button>
              ) : null}
              {canCreateAccount ? (
                <button
                  className="btn btn-ghost !min-h-0 !w-fit !p-0"
                  type="button"
                  onClick={() => onCreateAccount(person)}
                >
                  Створити обліковий запис
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

