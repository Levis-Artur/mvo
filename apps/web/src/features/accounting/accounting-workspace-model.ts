import type { AccountingOverview } from '@/lib/types';

export type AccountingWorkspaceTab =
  | 'overview'
  | 'imports'
  | 'transfers'
  | 'transactions'
  | 'stock';

export const accountingWorkspaceTabs: {
  id: AccountingWorkspaceTab;
  label: string;
}[] = [
  { id: 'overview', label: 'Огляд' },
  { id: 'imports', label: 'Імпорт' },
  { id: 'transfers', label: 'Передачі МВО' },
  { id: 'transactions', label: 'Рух майна' },
  { id: 'stock', label: 'Залишки' },
];

type Operation = AccountingOverview['recentOperations'][number];

export function operationPersonLabel(operation: Operation) {
  const person = operation.responsiblePerson;
  const name = [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ');
  const number = person.externalAccountingCode ?? '—';
  return number ? `${number} — ${name}` : name;
}

export function operationDocumentLabel(operation: Operation) {
  if (operation.document?.displayNumber) {
    return `№ ${operation.document.displayNumber}`;
  }
  return operation.sourceDocument || 'Системна операція';
}

export function operationDescription(operation: Operation) {
  const item = operation.inventoryItem;
  return `${item.externalCode} — ${item.name}`;
}
