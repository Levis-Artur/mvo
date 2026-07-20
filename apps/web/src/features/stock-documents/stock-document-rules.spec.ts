import type {
  AuthUser,
  AvailableStockSource,
  ResponsiblePerson,
  StockDocument,
  StockDocumentInput,
  TransferTarget,
} from '@/lib/types';
import {
  availableSourceOptions,
  canAddDocumentLine,
  canChangeStockDocuments,
  documentActionState,
  documentDirection,
  documentPostingBlocker,
  documentRecipientMode,
  documentStatusPresentation,
  filterRecipientOptions,
  lifecycleActions,
  personOptionLabel,
  parseStockDocumentQuickAction,
  recipientOptions,
  resolveSourceId,
  validateDocumentInput,
} from './stock-document-rules';

const mvoUser = { id: 'user-1', username: 'mvo', role: 'MVO', responsiblePersonId: 'person-1' } as AuthUser;
const auditor = { ...mvoUser, role: 'AUDITOR' } as AuthUser;
const accountant = { ...mvoUser, role: 'ACCOUNTANT' } as AuthUser;
const person = (id: string, active = true) => ({
  id, isActive: active, personnelNumber: id, lastName: id, firstName: 'Ім’я', middleName: null,
  management: { id: 'management-1', name: 'Управління забезпечення' },
}) as ResponsiblePerson;
const target = (id: string): TransferTarget => ({
  id,
  personnelNumber: id,
  fullName: `${id} Ім’я`,
  management: { id: 'management-1', name: 'Управління забезпечення' },
  service: { id: 'service-1', name: 'Служба забезпечення' },
  unit: null,
});
const source = (id: string, quantity: string, kind: 'DIRECT' | 'ASSIGNED' = 'DIRECT'): AvailableStockSource => ({
  sourceKind: kind,
  inventoryItem: { id, externalCode: id, name: id, unitOfMeasure: 'шт' },
  accountingOwner: { id: 'owner-1', fullName: 'Власник Один', personnelNumber: '001' },
  currentCustodian: { id: 'person-1', fullName: 'Утримувач Один', personnelNumber: '002' },
  availableQuantity: quantity,
  sourceBalanceId: `${kind}-${id}`,
  canAssign: true,
  canIssue: true,
});
const line = (kind: 'DIRECT' | 'ASSIGNED' = 'DIRECT') => ({
  inventoryItemId: 'item-1', quantity: '2', sourceKind: kind,
  accountingOwnerResponsiblePersonId: 'owner-1',
  sourceCustodianResponsiblePersonId: kind === 'ASSIGNED' ? 'person-1' : undefined,
  sourceCustodyBalanceId: kind === 'ASSIGNED' ? 'ASSIGNED-item-1' : undefined,
});
const input = (patch: Partial<StockDocumentInput> = {}): StockDocumentInput => ({
  type: 'ASSIGNMENT', documentDate: '2026-07-16T00:00:00.000Z',
  sourceResponsiblePersonId: 'person-1', destinationResponsiblePersonId: 'person-2',
  lines: [line()], ...patch,
});

describe('stock document frontend rules', () => {
  it('створює нову передачу тільки як ASSIGNMENT і підтримує попередній вибір source', () => {
    expect(parseStockDocumentQuickAction('?create=ASSIGNMENT&sourceResponsiblePersonId=person-1&sourceBalanceId=balance-1'))
      .toEqual({ type: 'ASSIGNMENT', sourceResponsiblePersonId: 'person-1', sourceBalanceId: 'balance-1' });
    expect(parseStockDocumentQuickAction('?create=TRANSFER&sourceResponsiblePersonId=person-1')).toBeNull();
  });

  it('AUDITOR і ACCOUNTANT мають read-only UI, а MVO може створювати власні документи', () => {
    expect(canChangeStockDocuments(mvoUser)).toBe(true);
    expect(canChangeStockDocuments(auditor)).toBe(false);
    expect(canChangeStockDocuments(accountant)).toBe(false);
  });

  it('MVO не може підмінити source, OWNER і DPP можуть його вибирати', () => {
    expect(resolveSourceId(mvoUser, 'another-person')).toBe('person-1');
    expect(resolveSourceId({ role: 'OWNER', responsiblePersonId: null }, 'person-3')).toBe('person-3');
    expect(resolveSourceId({ role: 'DPP_ADMIN', responsiblePersonId: null }, 'person-4')).toBe('person-4');
  });

  it('виключає відправника та шукає за номером, ПІБ і управлінням', () => {
    expect(recipientOptions([target('001'), target('003')], '001').map((item) => item.id)).toEqual(['003']);
    expect(personOptionLabel(person('003'))).toBe('003 — 003 Ім’я — Управління забезпечення');
    const arthur = { ...target('person-2'), personnelNumber: '003', fullName: 'Левіс Артур Сергійович' };
    expect(filterRecipientOptions([arthur], 'person-1', '003')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'левіс артур')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'забезпечення')).toEqual([arthur]);
  });

  it('ISSUE використовує зовнішнього одержувача, ASSIGNMENT — нового holder', () => {
    expect(documentRecipientMode('ISSUE')).toBe('EXTERNAL');
    expect(documentRecipientMode('ASSIGNMENT')).toBe('MVO');
  });

  it('не змішує DIRECT і ASSIGNED та дозволяє передати assigned item далі', () => {
    const direct = source('item-1', '2');
    const assigned = source('item-2', '3', 'ASSIGNED');
    expect(availableSourceOptions([direct, assigned], ['item-1'])).toEqual([assigned]);
    expect(canAddDocumentLine([assigned], [], true, false)).toBe(true);
    expect(validateDocumentInput(input({ lines: [line('ASSIGNED')] }), [source('item-1', '3', 'ASSIGNED')])).toBe('');
  });

  it('забороняє кількість понад доступне джерело та legacy TRANSFER', () => {
    expect(validateDocumentInput(input(), [source('item-1', '1')])).toBe('Кількість не може перевищувати доступний залишок');
    expect(validateDocumentInput(input({ type: 'TRANSFER' }), [source('item-1', '5')])).toBe('Нові документи старого типу TRANSFER створювати не можна');
  });

  it('перевіряє поля ASSIGNMENT та ISSUE', () => {
    expect(validateDocumentInput(input({ destinationResponsiblePersonId: undefined }), [source('item-1', '5')])).toBe('Виберіть нового фактичного утримувача');
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: '' }), [source('item-1', '5')])).toBe('Вкажіть одержувача');
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: 'Одержувач', basis: '' }), [source('item-1', '5')])).toBe('Вкажіть мету або підставу видачі');
  });

  it('блокує POST ISSUE без attachment', () => {
    expect(documentPostingBlocker({ type: 'ISSUE', attachments: [] })).toContain('щонайменше одне фото');
    expect(documentPostingBlocker({ type: 'ISSUE', attachments: [{ id: 'file-1' }] as StockDocument['attachments'] })).toBe('');
  });

  it('legacy transfer завжди read-only, POSTED ASSIGNMENT можна лише скасувати', () => {
    expect(lifecycleActions({ type: 'TRANSFER', status: 'DRAFT', sourceResponsiblePersonId: 'person-1' }, mvoUser)).toEqual({ edit: false, post: false, remove: false, cancel: false });
    expect(lifecycleActions({ type: 'ASSIGNMENT', status: 'POSTED', sourceResponsiblePersonId: 'person-1' }, mvoUser)).toEqual({ edit: false, post: false, remove: false, cancel: true });
  });

  it('показує точний action error і розрізняє типи документів', () => {
    expect(documentActionState('Недостатній залишок для reversal', false).error).toBe('Недостатній залишок для reversal');
    const document = { type: 'ASSIGNMENT', destinationResponsiblePersonId: 'person-1' } as StockDocument;
    expect(documentDirection(document, mvoUser)).toBe('Вхідна передача');
    expect(documentDirection({ ...document, type: 'ISSUE' }, mvoUser)).toBe('Видача');
    expect(documentDirection({ ...document, type: 'TRANSFER' }, mvoUser)).toBe('Стара логіка');
  });

  it('оформлює статуси документа стабільно', () => {
    expect(documentStatusPresentation('DRAFT').label).toBe('DRAFT');
    expect(documentStatusPresentation('POSTED').tone).toBe('success');
    expect(documentStatusPresentation('CANCELLED').tone).toBe('neutral');
  });
});
