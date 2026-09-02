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
import { formatQuantity } from '../inventory/quantity-format';
import type { DocumentFormLine } from './stock-document.types';

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
    .filter(
      (person) =>
        person.id !== sourceId && /^\d{4}$/.test(person.externalAccountingCode),
    )
    .sort((left, right) =>
      left.externalAccountingCode.localeCompare(right.externalAccountingCode, 'uk-UA', { numeric: true }) ||
      personSearchText(left).localeCompare(personSearchText(right), 'uk-UA'),
    );
}

export function personOptionLabel(person: ResponsiblePerson | TransferTarget) {
  const name = 'fullName' in person
    ? person.fullName
    : [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
  return `${person.externalAccountingCode ?? 'Не вказано'} — ${name} — ${person.management?.name ?? 'Без управління'}`;
}

export function filterRecipientOptions(persons: TransferTarget[], sourceId: string, search: string) {
  const needle = search.trim().toLocaleLowerCase('uk-UA');
  const options = recipientOptions(persons, sourceId);
  if (!needle) return options;
  return options.filter((person) => personSearchText(person).toLocaleLowerCase('uk-UA').includes(needle));
}

function personSearchText(person: TransferTarget) {
  return [person.externalAccountingCode, person.fullName, person.management?.name]
    .filter(Boolean).join(' ');
}

export function documentLineError(
  line: StockDocumentInput['lines'][number] &
    Partial<Pick<DocumentFormLine, 'sourceBalanceId'>>,
  sources: AvailableStockSource[],
) {
  const source = sources.find((item) =>
    item.inventoryItem.id === line.inventoryItemId &&
    (!line.sourceBalanceId || item.balanceId === line.sourceBalanceId),
  );
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Кількість повинна бути більшою за 0';
  if (!source || quantity > Number(source.availableQuantity)) return 'Кількість не може перевищувати доступний залишок';
  return '';
}

export function validateDocumentInput(
  input: StockDocumentInput,
  sources: AvailableStockSource[],
  options: { requireIssueBasis?: boolean } = {},
) {
  if (!input.sourceResponsiblePersonId) return 'Виберіть МВО-відправника';
  if (input.type === 'TRANSFER' || input.type === 'ASSIGNMENT') {
    return 'Старі типи передач доступні лише для перегляду';
  }
  if (input.type === 'MVO_TRANSFER' && !input.destinationResponsiblePersonId) {
    return 'Виберіть МВО-одержувача';
  }
  if (
    input.type === 'MVO_TRANSFER' &&
    input.destinationResponsiblePersonId === input.sourceResponsiblePersonId
  ) {
    return 'Відправник і одержувач не можуть бути одним МВО';
  }
  if (input.type === 'ISSUE' && !input.recipientName?.trim()) return 'Вкажіть одержувача';
  if (
    input.type === 'ISSUE' &&
    options.requireIssueBasis !== false &&
    !input.basis?.trim()
  ) return 'Вкажіть мету або підставу видачі';
  if (!input.lines.length) return 'Додайте хоча б одну позицію';
  const sourceKeys = new Set<string>();
  for (const line of input.lines) {
    const untrustedLine = line as typeof line & Record<string, unknown>;
    if (
      untrustedLine.sourceKind !== undefined ||
      untrustedLine.accountingOwnerResponsiblePersonId !== undefined ||
      untrustedLine.sourceCustodyBalanceId !== undefined
    ) {
      return 'Для нового документа можна вибирати лише власний поточний залишок';
    }
    const sourceKey = line.sourceBalanceId;
    if (!sourceKey) {
      return 'Виберіть залишок для кожного рядка';
    }
    if (sourceKeys.has(sourceKey)) return 'Одне джерело майна не можна додавати двічі';
    sourceKeys.add(sourceKey);
    const error = documentLineError(line, sources);
    if (error) return error;
  }
  return '';
}

export function documentDirection(document: StockDocument) {
  if (document.type === 'ISSUE') return 'Видача';
  if (document.type === 'MVO_TRANSFER') return 'Передача';
  return 'Стара логіка';
}

export function documentDirectionPresentation(
  document: StockDocument,
): { label: string; tone: StatusTone } {
  const label = documentDirection(document);
  return {
    label,
    tone: label === 'Видача' ? 'warning' : label === 'Передача' ? 'info' : 'neutral',
  };
}

export function documentTypeLabel(type: StockDocumentType) {
  if (type === 'ISSUE') return 'Видача';
  if (type === 'MVO_TRANSFER') return 'Передача';
  return 'Стара передача';
}

export function documentNumberLabel(displayNumber: number) {
  return `№ ${displayNumber}`;
}

export function documentVolumePresentation(totalPositions: number, totalQuantity: string) {
  const quantity = formatQuantity(totalQuantity);
  const lastTwoDigits = totalPositions % 100;
  const lastDigit = totalPositions % 10;
  const positionWord = lastDigit === 1 && lastTwoDigits !== 11
    ? 'позиція'
    : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
      ? 'позиції'
      : 'позицій';
  return {
    compact: `${totalPositions} поз. · ${quantity} од.`,
    full: `${totalPositions} ${positionWord}, загальна кількість ${quantity} одиниць`,
  };
}

export function documentCounterparty(
  document: StockDocument,
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
) {
  if (document.type === 'ISSUE') {
    return `Кому: ${document.recipientName ?? 'Не вказано'}`;
  }
  if (document.destinationResponsiblePersonId === user.responsiblePersonId) {
    return `Від кого: ${document.sourceResponsiblePerson.externalAccountingCode ?? '—'} — ${document.sourceResponsiblePerson.lastName} ${document.sourceResponsiblePerson.firstName}`;
  }
  const destination = document.destinationResponsiblePerson;
  return `Кому: ${destination ? `${destination.externalAccountingCode ?? '—'} — ${destination.lastName} ${destination.firstName}` : 'Не вказано'}`;
}

export function successfulDocumentActionMessage(
  document: StockDocument,
  action: 'post' | 'cancel' | 'remove',
) {
  if (action === 'remove') return 'Чернетку видалено.';
  if (action === 'cancel') {
    return document.type === 'ISSUE' && document.sourceTransferId
      ? 'Видачу скасовано. Доступну для оформлення кількість передачі відновлено.'
      : 'Документ скасовано. Попередній стан майна відновлено.';
  }
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
export const documentRecipientMode = (type: StockDocumentType) =>
  type === 'MVO_TRANSFER' ? 'MVO' : 'EXTERNAL';

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
  document: Pick<StockDocument, 'status' | 'sourceResponsiblePersonId' | 'type'> &
    Partial<Pick<StockDocument, 'accountingExportState' | 'lines' | 'sourceTransferId'>>,
  user: Pick<AuthUser, 'role' | 'responsiblePersonId'>,
) {
  const transferDocument =
    document.type === 'MVO_TRANSFER' &&
    !document.lines?.some((line) => !line.sourceBalanceId);
  const issueDocument = document.type === 'ISSUE';
  const writable = (transferDocument || issueDocument) && canChangeStockDocuments(user) && (
    user.role !== 'MVO' || document.sourceResponsiblePersonId === user.responsiblePersonId
  );
  return {
    edit: writable && transferDocument && document.status === 'DRAFT',
    post: writable && transferDocument && document.status === 'DRAFT',
    remove: writable && transferDocument && document.status === 'DRAFT',
    cancel:
      writable &&
      (transferDocument || issueDocument) &&
      document.status === 'POSTED' &&
      !(
        document.type === 'MVO_TRANSFER' &&
        document.accountingExportState === 'EXPORTED'
      ),
  };
}
