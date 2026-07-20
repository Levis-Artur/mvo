import type {
  AuthUser,
  AvailableStockSource,
  ResponsiblePerson,
  StockDocument,
  StockDocumentInput,
  StockDocumentStatus,
  StockDocumentType,
} from '@/lib/types';
import type { StatusTone } from '@/components/ui';

export function parseStockDocumentQuickAction(search: string): {
  type: StockDocumentType;
  sourceResponsiblePersonId: string;
  sourceBalanceId?: string;
} | null {
  const params = new URLSearchParams(search);
  const type = params.get('create');
  const sourceResponsiblePersonId = params.get('sourceResponsiblePersonId');
  const sourceBalanceId = params.get('sourceBalanceId') ?? undefined;
  if ((type !== 'ASSIGNMENT' && type !== 'ISSUE') || !sourceResponsiblePersonId) return null;
  return { type, sourceResponsiblePersonId, sourceBalanceId };
}

export function canChangeStockDocuments(user: Pick<AuthUser, 'role'>) {
  return user.role !== 'AUDITOR' && user.role !== 'ACCOUNTANT';
}

export function resolveSourceId(
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
  selectedSourceId: string,
) {
  return user.role === 'MVO' ? (user.responsiblePersonId ?? '') : selectedSourceId;
}

export function recipientOptions(persons: ResponsiblePerson[], sourceId: string) {
  return persons
    .filter((person) => person.id !== sourceId && person.isActive)
    .sort((left, right) =>
      left.personnelNumber.localeCompare(right.personnelNumber, 'uk-UA', { numeric: true }) ||
      personSearchText(left).localeCompare(personSearchText(right), 'uk-UA'),
    );
}

export function personOptionLabel(person: ResponsiblePerson) {
  const name = [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
  return `${person.personnelNumber} — ${name} — ${person.management?.name ?? 'Без управління'}`;
}

export function filterRecipientOptions(persons: ResponsiblePerson[], sourceId: string, search: string) {
  const needle = search.trim().toLocaleLowerCase('uk-UA');
  const options = recipientOptions(persons, sourceId);
  if (!needle) return options;
  return options.filter((person) => personSearchText(person).toLocaleLowerCase('uk-UA').includes(needle));
}

function personSearchText(person: ResponsiblePerson) {
  return [person.personnelNumber, person.lastName, person.firstName, person.middleName, person.management?.name]
    .filter(Boolean).join(' ');
}

export function availableSourceOptions(sources: AvailableStockSource[], selectedItemIds: string[]) {
  return sources.filter((source) =>
    Number(source.availableQuantity) > 0 && !selectedItemIds.includes(source.inventoryItem.id),
  );
}

export function canAddDocumentLine(
  sources: AvailableStockSource[], selectedItemIds: string[], sourceReady: boolean, loading: boolean,
) {
  return sourceReady && !loading && availableSourceOptions(sources, selectedItemIds).length > 0;
}

export function documentLineError(
  line: StockDocumentInput['lines'][number],
  sources: AvailableStockSource[],
) {
  const source = sources.find((item) =>
    item.inventoryItem.id === line.inventoryItemId &&
    item.sourceKind === line.sourceKind &&
    item.accountingOwner.id === line.accountingOwnerResponsiblePersonId &&
    (line.sourceKind === 'DIRECT' || item.sourceBalanceId === line.sourceCustodyBalanceId),
  );
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Кількість повинна бути більшою за 0';
  if (!source || quantity > Number(source.availableQuantity)) return 'Кількість не може перевищувати доступний залишок';
  return '';
}

export function validateDocumentInput(input: StockDocumentInput, sources: AvailableStockSource[]) {
  if (!input.sourceResponsiblePersonId) return 'Виберіть МВО-відправника';
  if (input.type === 'TRANSFER') return 'Нові документи старого типу TRANSFER створювати не можна';
  if (input.type === 'ASSIGNMENT' && !input.destinationResponsiblePersonId) return 'Виберіть нового фактичного утримувача';
  if (input.type === 'ISSUE' && !input.recipientName?.trim()) return 'Вкажіть одержувача';
  if (input.type === 'ISSUE' && !input.basis?.trim()) return 'Вкажіть мету або підставу видачі';
  if (!input.lines.length) return 'Додайте хоча б одну позицію';
  const ids = new Set<string>();
  for (const line of input.lines) {
    if (ids.has(line.inventoryItemId)) return 'Номенклатуру не можна дублювати';
    ids.add(line.inventoryItemId);
    const error = documentLineError(line, sources);
    if (error) return error;
  }
  return '';
}

export function documentDirection(document: StockDocument, user: Pick<AuthUser, 'role' | 'responsiblePersonId'>) {
  if (document.type === 'ISSUE') return 'Видача';
  if (document.type === 'TRANSFER') return 'Стара логіка';
  if (user.role === 'MVO' && document.destinationResponsiblePersonId === user.responsiblePersonId) {
    return 'Вхідна передача';
  }
  return 'Вихідна передача';
}

export function documentDirectionPresentation(
  document: StockDocument,
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
): { label: string; tone: StatusTone } {
  const label = documentDirection(document, user);
  return {
    label,
    tone: label === 'Вхідна передача' ? 'success' : label === 'Видача' ? 'warning' : label === 'Стара логіка' ? 'neutral' : 'info',
  };
}

const statusPresentation: Record<StockDocumentStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'DRAFT', tone: 'info' },
  POSTED: { label: 'POSTED', tone: 'success' },
  CANCELLED: { label: 'CANCELLED', tone: 'neutral' },
};

export const documentStatusPresentation = (status: StockDocumentStatus) => statusPresentation[status];
export const documentRecipientMode = (type: StockDocumentType) => type === 'ISSUE' ? 'EXTERNAL' : 'MVO';

export function documentActionState(error: string, loading: boolean) {
  return { error, loading, disabled: loading };
}

export function documentPostingBlocker(
  document: Pick<StockDocument, 'type' | 'attachments'>,
) {
  return document.type === 'ISSUE' && document.attachments.length === 0
    ? 'Для проведення видачі потрібно додати щонайменше одне фото або PDF накладної.'
    : '';
}

export function lifecycleActions(
  document: Pick<StockDocument, 'status' | 'sourceResponsiblePersonId' | 'type'>,
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
) {
  const writable = document.type !== 'TRANSFER' && canChangeStockDocuments(user) && (
    user.role !== 'MVO' || document.sourceResponsiblePersonId === user.responsiblePersonId
  );
  return {
    edit: writable && document.status === 'DRAFT',
    post: writable && document.status === 'DRAFT',
    remove: writable && document.status === 'DRAFT',
    cancel: writable && document.status === 'POSTED',
  };
}
