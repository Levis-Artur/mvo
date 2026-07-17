import type {
  AuthUser,
  ResponsiblePerson,
  StockBalance,
  StockDocument,
  StockDocumentInput,
  StockDocumentType,
} from '@/lib/types';

export function parseStockDocumentQuickAction(search: string): {
  type: StockDocumentType;
  sourceResponsiblePersonId: string;
} | null {
  const params = new URLSearchParams(search);
  const type = params.get('create');
  const sourceResponsiblePersonId = params.get('sourceResponsiblePersonId');
  if (
    (type !== 'TRANSFER' && type !== 'ISSUE') ||
    !sourceResponsiblePersonId
  ) {
    return null;
  }
  return { type, sourceResponsiblePersonId };
}

export function canChangeStockDocuments(user: Pick<AuthUser, 'role'>) {
  return user.role !== 'AUDITOR';
}

export function resolveSourceId(
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
  selectedSourceId: string,
) {
  return user.role === 'MVO'
    ? (user.responsiblePersonId ?? '')
    : selectedSourceId;
}

export function recipientOptions(
  persons: ResponsiblePerson[],
  sourceId: string,
) {
  return persons
    .filter((person) => person.id !== sourceId && person.isActive)
    .sort(
      (left, right) =>
        left.personnelNumber.localeCompare(right.personnelNumber, 'uk-UA', {
          numeric: true,
        }) ||
        personSearchText(left).localeCompare(personSearchText(right), 'uk-UA'),
    );
}

export function personOptionLabel(person: ResponsiblePerson) {
  const name = [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ');
  return `${person.personnelNumber} — ${name}`;
}

export function filterRecipientOptions(
  persons: ResponsiblePerson[],
  sourceId: string,
  search: string,
) {
  const needle = search.trim().toLocaleLowerCase('uk-UA');
  const options = recipientOptions(persons, sourceId);
  if (!needle) return options;
  return options.filter((person) =>
    personSearchText(person).toLocaleLowerCase('uk-UA').includes(needle),
  );
}

function personSearchText(person: ResponsiblePerson) {
  return [
    person.personnelNumber,
    person.lastName,
    person.firstName,
    person.middleName,
    person.management?.name,
  ]
    .filter(Boolean)
    .join(' ');
}

export function availableBalanceOptions(
  balances: StockBalance[],
  selectedItemIds: string[],
) {
  return balances.filter(
    (balance) =>
      Number(balance.quantity) > 0 &&
      !selectedItemIds.includes(balance.inventoryItem.id),
  );
}

export function canAddDocumentLine(
  balances: StockBalance[],
  selectedItemIds: string[],
  sourceReady: boolean,
  loading: boolean,
) {
  return (
    sourceReady &&
    !loading &&
    availableBalanceOptions(balances, selectedItemIds).length > 0
  );
}

export function validateDocumentInput(
  input: StockDocumentInput,
  balances: StockBalance[],
) {
  if (!input.sourceResponsiblePersonId) return 'Виберіть МВО-відправника';
  if (input.type === 'TRANSFER' && !input.destinationResponsiblePersonId) {
    return 'Виберіть МВО-одержувача';
  }
  if (input.type === 'ISSUE' && !input.recipientName?.trim()) {
    return 'Вкажіть одержувача';
  }
  if (!input.lines.length) return 'Додайте хоча б одну позицію';
  const ids = new Set<string>();
  for (const line of input.lines) {
    if (ids.has(line.inventoryItemId)) return 'Номенклатуру не можна дублювати';
    ids.add(line.inventoryItemId);
    const balance = balances.find(
      (item) => item.inventoryItem.id === line.inventoryItemId,
    );
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return 'Кількість повинна бути більшою за 0';
    }
    if (!balance || quantity > Number(balance.quantity)) {
      return 'Кількість не може перевищувати доступний залишок';
    }
  }
  return '';
}

export function documentDirection(
  document: StockDocument,
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
) {
  if (document.type === 'ISSUE') return 'Видача';
  if (
    user.role === 'MVO' &&
    document.destinationResponsiblePersonId === user.responsiblePersonId
  ) {
    return 'Вхідна передача';
  }
  return 'Вихідна передача';
}

export function lifecycleActions(
  document: Pick<StockDocument, 'status'>,
  user: Pick<AuthUser, 'role'>,
) {
  const writable = canChangeStockDocuments(user);
  return {
    edit: writable && document.status === 'DRAFT',
    post: writable && document.status === 'DRAFT',
    remove: writable && document.status === 'DRAFT',
    cancel: writable && document.status === 'POSTED',
  };
}
