import type {
  AuthUser,
  AvailableStockSource,
  ResponsiblePerson,
  StockDocument,
  StockDocumentInput,
  TransferTarget,
} from '@/lib/types';
import {
  canChangeStockDocuments,
  documentActionState,
  documentDirection,
  documentNumberLabel,
  documentPostingBlocker,
  documentRecipientMode,
  documentStatusPresentation,
  documentTypeLabel,
  documentVolumePresentation,
  filterRecipientOptions,
  lifecycleActions,
  personOptionLabel,
  recipientOptions,
  resolveSourceId,
  shouldConfirmUnsavedDocument,
  successfulDocumentActionMessage,
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
const source = (id: string, quantity: string): AvailableStockSource => ({
  inventoryItem: { id, externalCode: id, name: id, unitOfMeasure: 'шт' },
  availableQuantity: quantity,
  balanceId: `balance-${id}`,
  unit: 'шт',
  canTransfer: true,
  canIssue: true,
});
const line = () => ({
  inventoryItemId: 'item-1', quantity: '2', sourceBalanceId: 'balance-item-1',
});
const input = (patch: Partial<StockDocumentInput> = {}): StockDocumentInput => ({
  type: 'ISSUE', documentDate: '2026-07-16T00:00:00.000Z',
  sourceResponsiblePersonId: 'person-1', recipientName: 'Одержувач', basis: 'Підстава',
  lines: [line()], ...patch,
});

describe('stock document frontend rules', () => {
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

  it('ISSUE використовує зовнішнього одержувача, MVO_TRANSFER — МВО-одержувача', () => {
    expect(documentRecipientMode('ISSUE')).toBe('EXTERNAL');
    expect(documentRecipientMode('MVO_TRANSFER')).toBe('MVO');
  });

  it('дозволяє лише прямий залишок і відхиляє ASSIGNED source', () => {
    expect(validateDocumentInput(input(), [source('item-1', '3')])).toBe('');
    expect(validateDocumentInput(input({ lines: [{ ...line(), sourceKind: 'ASSIGNED' }] }), [source('item-1', '3')]))
      .toBe('Для нового документа можна вибирати лише власний поточний залишок');
  });

  it('забороняє кількість понад доступне джерело та обидва legacy типи передач', () => {
    expect(validateDocumentInput(input(), [source('item-1', '1')])).toBe('Кількість не може перевищувати доступний залишок');
    expect(validateDocumentInput(input({ type: 'TRANSFER' }), [source('item-1', '5')])).toBe('Старі типи передач доступні лише для перегляду');
    expect(validateDocumentInput(input({ type: 'ASSIGNMENT' }), [source('item-1', '5')])).toBe('Старі типи передач доступні лише для перегляду');
  });

  it('перевіряє обов’язкові поля ISSUE', () => {
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: '' }), [source('item-1', '5')])).toBe('Вкажіть одержувача');
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: 'Одержувач', basis: '' }), [source('item-1', '5')])).toBe('Вкажіть мету або підставу видачі');
  });

  it('блокує POST ISSUE без attachment', () => {
    expect(documentPostingBlocker({ type: 'ISSUE', attachments: [] })).toContain('щонайменше одне фото');
    expect(documentPostingBlocker({ type: 'ISSUE', attachments: [{ id: 'file-1' }] as StockDocument['attachments'] })).toBe('');
  });

  it('обидва старі типи передач завжди read-only', () => {
    expect(lifecycleActions({ type: 'TRANSFER', status: 'DRAFT', sourceResponsiblePersonId: 'person-1' }, mvoUser)).toEqual({ edit: false, post: false, remove: false, cancel: false });
    expect(lifecycleActions({ type: 'ASSIGNMENT', status: 'POSTED', sourceResponsiblePersonId: 'person-1' }, mvoUser)).toEqual({ edit: false, post: false, remove: false, cancel: false });
  });

  it('дозволяє редагувати нову видачу та MVO_TRANSFER лише з sourceBalanceId', () => {
    expect(lifecycleActions({
      type: 'ISSUE', status: 'DRAFT', sourceResponsiblePersonId: 'person-1',
      lines: [{ sourceBalanceId: 'balance-1' }] as StockDocument['lines'],
    }, mvoUser).edit).toBe(true);
    expect(lifecycleActions({
      type: 'MVO_TRANSFER', status: 'DRAFT', sourceResponsiblePersonId: 'person-1',
      lines: [{ sourceBalanceId: 'balance-1' }] as StockDocument['lines'],
    }, mvoUser).edit).toBe(true);
  });

  it('показує точний action error і розрізняє типи документів', () => {
    expect(documentActionState('Недостатній залишок для reversal', false).error).toBe('Недостатній залишок для reversal');
    const document = { type: 'ASSIGNMENT', destinationResponsiblePersonId: 'person-1' } as StockDocument;
    expect(documentDirection(document)).toBe('Стара логіка');
    expect(documentDirection({ ...document, type: 'ISSUE' })).toBe('Видача');
    expect(documentDirection({ ...document, type: 'TRANSFER' })).toBe('Стара логіка');
  });

  it('оформлює статуси документа стабільно', () => {
    expect(documentStatusPresentation('DRAFT').label).toBe('Чернетка');
    expect(documentStatusPresentation('POSTED').label).toBe('Проведено');
    expect(documentStatusPresentation('CANCELLED').label).toBe('Скасовано');
    expect(documentStatusPresentation('POSTED').tone).toBe('success');
    expect(documentStatusPresentation('CANCELLED').tone).toBe('neutral');
  });

  it('не показує технічні типи та формує послідовний номер документа', () => {
    expect(documentTypeLabel('ASSIGNMENT')).toBe('Стара передача');
    expect(documentTypeLabel('ISSUE')).toBe('Видача');
    expect(documentTypeLabel('TRANSFER')).toBe('Стара передача');
    expect(documentNumberLabel(1)).toBe('№ 1');
    expect(documentNumberLabel(42)).toBe('№ 42');
  });

  it('формує компактний обсяг і правильне відмінювання позицій', () => {
    expect(documentVolumePresentation(1, '5')).toEqual({
      compact: '1 поз. · 5 од.',
      full: '1 позиція, загальна кількість 5 одиниць',
    });
    expect(documentVolumePresentation(3, '9.5').full).toBe(
      '3 позиції, загальна кількість 9,5 одиниць',
    );
    expect(documentVolumePresentation(5, '12').full).toBe(
      '5 позицій, загальна кількість 12 одиниць',
    );
    expect(documentVolumePresentation(11, '20').full).toBe(
      '11 позицій, загальна кількість 20 одиниць',
    );
  });

  it('формує людський підсумок успішної передачі', () => {
    const document = {
      type: 'MVO_TRANSFER', totalQuantity: '2', recipientName: null,
      destinationResponsiblePerson: person('person-2'),
      lines: [{ inventoryItem: { name: 'Клавіатура' } }],
    } as StockDocument;
    expect(successfulDocumentActionMessage(document, 'post')).toContain('Клавіатура');
    expect(successfulDocumentActionMessage(document, 'post')).toContain('кількість 2');
    expect(successfulDocumentActionMessage(document, 'post')).toContain('Кому:');
  });

  it('підтверджує закриття лише для зміненої незбереженої форми', () => {
    expect(shouldConfirmUnsavedDocument(true, false)).toBe(true);
    expect(shouldConfirmUnsavedDocument(false, false)).toBe(false);
    expect(shouldConfirmUnsavedDocument(true, true)).toBe(false);
  });
});
