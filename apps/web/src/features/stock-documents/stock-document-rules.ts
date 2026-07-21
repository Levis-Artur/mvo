import type {
  AuthUser,
  AvailableStockSource,
  ResponsiblePerson,
  StockDocument,
  StockDocumentInput,
  StockDocumentStatus,
  StockDocumentType,
  TransferTarget,
} from '@/lib/types';
import type { StatusTone } from '@/components/ui';
import type { DocumentFormLine } from './stock-document.types';

export function parseStockDocumentQuickAction(search: string): {
  type: StockDocumentType;
  sourceResponsiblePersonId: string;
  sourceBalanceId?: string;
  sourceKind?: 'DIRECT' | 'ASSIGNED';
} | null {
  const params = new URLSearchParams(search);
  const type = params.get('create');
  const sourceResponsiblePersonId = params.get('sourceResponsiblePersonId');
  const sourceBalanceId = params.get('sourceBalanceId') ?? undefined;
  const rawSourceKind = params.get('sourceKind');
  const sourceKind = rawSourceKind === 'DIRECT' || rawSourceKind === 'ASSIGNED' ? rawSourceKind : undefined;
  if ((type !== 'ASSIGNMENT' && type !== 'ISSUE') || !sourceResponsiblePersonId) return null;
  return { type, sourceResponsiblePersonId, sourceBalanceId, sourceKind };
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

export function recipientOptions(persons: TransferTarget[], sourceId: string) {
  return persons
    .filter((person) => person.id !== sourceId)
    .sort((left, right) =>
      left.personnelNumber.localeCompare(right.personnelNumber, 'uk-UA', { numeric: true }) ||
      personSearchText(left).localeCompare(personSearchText(right), 'uk-UA'),
    );
}

export function personOptionLabel(person: ResponsiblePerson | TransferTarget) {
  const name = 'fullName' in person
    ? person.fullName
    : [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
  return `${person.personnelNumber} — ${name} — ${person.management?.name ?? 'Без управління'}`;
}

export function filterRecipientOptions(persons: TransferTarget[], sourceId: string, search: string) {
  const needle = search.trim().toLocaleLowerCase('uk-UA');
  const options = recipientOptions(persons, sourceId);
  if (!needle) return options;
  return options.filter((person) => personSearchText(person).toLocaleLowerCase('uk-UA').includes(needle));
}

function personSearchText(person: TransferTarget) {
  return [person.personnelNumber, person.fullName, person.management?.name]
    .filter(Boolean).join(' ');
}

export function documentLineError(
  line: StockDocumentInput['lines'][number] & Partial<Pick<DocumentFormLine, 'sourceBalanceId'>>,
  sources: AvailableStockSource[],
) {
  const source = sources.find((item) =>
    item.inventoryItem.id === line.inventoryItemId &&
    item.sourceKind === line.sourceKind &&
    item.accountingOwner.id === line.accountingOwnerResponsiblePersonId &&
    (!line.sourceBalanceId || item.sourceBalanceId === line.sourceBalanceId) &&
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
  const sourceKeys = new Set<string>();
  for (const line of input.lines) {
    const sourceKey = line.sourceKind === 'ASSIGNED' && line.sourceCustodyBalanceId
      ? `${line.sourceKind}:${line.sourceCustodyBalanceId}`
      : `${line.sourceKind}:${line.accountingOwnerResponsiblePersonId}:${line.inventoryItemId}`;
    if (sourceKeys.has(sourceKey)) return 'Одне джерело майна не можна додавати двічі';
    sourceKeys.add(sourceKey);
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

export function documentTypeLabel(type: StockDocumentType) {
  if (type === 'ASSIGNMENT') return 'Передача';
  if (type === 'ISSUE') return 'Видача';
  return 'Стара передача';
}

export function documentNumberLabel(displayNumber: number) {
  return `№ ${displayNumber}`;
}

export function documentCounterparty(
  document: StockDocument,
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
) {
  if (document.type === 'ISSUE') {
    return `Кому: ${document.recipientName ?? 'Не вказано'}`;
  }
  if (document.destinationResponsiblePersonId === user.responsiblePersonId) {
    return `Від кого: ${document.sourceResponsiblePerson.lastName} ${document.sourceResponsiblePerson.firstName}`;
  }
  const destination = document.destinationResponsiblePerson;
  return `Кому: ${destination ? `${destination.lastName} ${destination.firstName}` : 'Не вказано'}`;
}

export function successfulDocumentActionMessage(
  document: StockDocument,
  action: 'post' | 'cancel' | 'remove',
) {
  if (action === 'remove') return 'Чернетку видалено.';
  if (action === 'cancel') return 'Документ скасовано. Попередній стан майна відновлено.';
  const firstItem = document.lines[0]?.inventoryItem.name ?? 'майно';
  const extra = document.lines.length > 1 ? ` та ще ${document.lines.length - 1}` : '';
  const quantity = document.totalQuantity;
  if (document.type === 'ISSUE') {
    return `Видачу проведено: ${firstItem}${extra}, кількість ${quantity}. Кому: ${document.recipientName ?? 'одержувачу'}.`;
  }
  const destination = document.destinationResponsiblePerson;
  const recipient = destination ? `${destination.lastName} ${destination.firstName}` : 'обраному МВО';
  return `Передачу проведено: ${firstItem}${extra}, кількість ${quantity}. Кому: ${recipient}.`;
}

const statusPresentation: Record<StockDocumentStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Чернетка', tone: 'info' },
  POSTED: { label: 'Проведено', tone: 'success' },
  CANCELLED: { label: 'Скасовано', tone: 'neutral' },
};

export const documentStatusPresentation = (status: StockDocumentStatus) => statusPresentation[status];
export const documentRecipientMode = (type: StockDocumentType) => type === 'ISSUE' ? 'EXTERNAL' : 'MVO';

export function documentActionState(error: string, loading: boolean) {
  return { error, loading, disabled: loading };
}

export function shouldConfirmUnsavedDocument(dirty: boolean, saving: boolean) {
  return dirty && !saving;
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
