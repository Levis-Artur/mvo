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
  documentCancellationMessage,
  validateDocumentInput,
} from './stock-document-rules';

const mvoUser = { id: 'user-1', username: 'mvo', role: 'MVO', responsiblePersonId: 'person-1' } as AuthUser;
const manager = { ...mvoUser, role: 'ORG_MANAGER', responsiblePersonId: null } as AuthUser;
const accountant = { ...mvoUser, role: 'ACCOUNTANT' } as AuthUser;
const person = (id: string, active = true) => ({
  id, isActive: active, lastName: id, firstName: 'Ім’я', middleName: null,
  externalAccountingName: null, externalAccountingCode: '0057',
  management: { id: 'management-1', name: 'Управління забезпечення' },
}) as ResponsiblePerson;
const target = (id: string): TransferTarget => ({
  id,
  externalAccountingCode: id === '001' ? '0057' : '1155',
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
  it('ORG_MANAGER і ACCOUNTANT не можуть змінювати документи, а MVO може створювати власні', () => {
    expect(canChangeStockDocuments(mvoUser)).toBe(true);
    expect(canChangeStockDocuments(manager)).toBe(false);
    expect(canChangeStockDocuments(accountant)).toBe(false);
  });

  it('MVO не може підмінити source, OWNER може його вибирати', () => {
    expect(resolveSourceId(mvoUser, 'another-person')).toBe('person-1');
    expect(resolveSourceId({ role: 'OWNER', responsiblePersonId: null }, 'person-3')).toBe('person-3');
  });

  it('виключає відправника та шукає за номером, ПІБ і управлінням', () => {
    expect(recipientOptions([target('001'), target('003')], '001').map((item) => item.id)).toEqual(['003']);
    expect(personOptionLabel(person('003'))).toBe('0057 — 003 Ім’я — Управління забезпечення');
    const arthur = { ...target('person-2'), externalAccountingCode: '0057', fullName: 'Левіс Артур Сергійович' };
    expect(filterRecipientOptions([arthur], 'person-1', '0057')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'левіс артур')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'забезпечення')).toEqual([arthur]);
    expect(filterRecipientOptions([{ ...arthur, externalAccountingCode: '' }], 'person-1', '')).toEqual([]);
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

  it('забороняє кількість понад доступне джерело', () => {
    expect(validateDocumentInput(input(), [source('item-1', '1')])).toBe('Кількість не може перевищувати доступний залишок');
  });

  it('перевіряє обов’язкові поля ISSUE', () => {
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: '' }), [source('item-1', '5')])).toBe('Вкажіть одержувача');
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: 'Одержувач', basis: '' }), [source('item-1', '5')])).toBe('Вкажіть мету або підставу видачі');
  });


  it('не дозволяє скасувати передачу після бухгалтерського експорту', () => {
    expect(lifecycleActions({
      type: 'MVO_TRANSFER',
      status: 'POSTED',
      accountingExportState: 'EXPORTED',
      sourceResponsiblePersonId: 'person-1',
    }, mvoUser).cancel).toBe(false);
    expect(lifecycleActions({
      type: 'MVO_TRANSFER',
      status: 'POSTED',
      accountingExportState: 'NOT_EXPORTED',
      sourceResponsiblePersonId: 'person-1',
    }, mvoUser).cancel).toBe(true);
  });

  it('не скасовує DRAFT ISSUE та дозволяє скасувати власну проведену видачу', () => {
    expect(lifecycleActions({
      type: 'ISSUE', status: 'DRAFT', sourceResponsiblePersonId: 'person-1',
      lines: [{ sourceBalanceId: 'balance-1' }] as StockDocument['lines'],
    }, mvoUser)).toEqual({ cancel: false });
    expect(lifecycleActions({
      type: 'ISSUE', status: 'DRAFT', sourceResponsiblePersonId: 'person-1',
      sourceTransferId: 'transfer-1',
    }, mvoUser)).toEqual({ cancel: false });
    expect(lifecycleActions({
      type: 'ISSUE', status: 'POSTED', sourceResponsiblePersonId: 'person-1',
      lines: [{ sourceBalanceId: 'balance-1' }] as StockDocument['lines'],
    }, mvoUser).cancel).toBe(true);
    expect(lifecycleActions({
      type: 'ISSUE', status: 'POSTED', sourceResponsiblePersonId: 'person-1',
      sourceTransferId: 'transfer-1',
    }, mvoUser).cancel).toBe(true);
  });

  it('пояснює скасування child ISSUE без заяви про відновлення StockBalance', () => {
    const message = documentCancellationMessage({
      type: 'ISSUE',
      sourceTransferId: 'transfer-1',
    } as StockDocument);

    expect(message).toBe('Видачу скасовано. Доступну для оформлення кількість передачі відновлено.');
    expect(message).not.toContain('стан майна відновлено');
  });

  it('показує точний action error і розрізняє типи документів', () => {
    expect(documentActionState('Недостатній залишок для reversal', false).error).toBe('Недостатній залишок для reversal');
    expect(documentDirection({ type: 'ISSUE' } as StockDocument)).toBe('Видача');
  });

  it('оформлює статуси документа стабільно', () => {
    expect(documentStatusPresentation('DRAFT').label).toBe('Чернетка');
    expect(documentStatusPresentation('POSTED').label).toBe('Проведено');
    expect(documentStatusPresentation('CANCELLED').label).toBe('Скасовано');
    expect(documentStatusPresentation('POSTED').tone).toBe('success');
    expect(documentStatusPresentation('CANCELLED').tone).toBe('neutral');
  });

  it('не показує технічні типи та формує послідовний номер документа', () => {
    expect(documentTypeLabel('ISSUE')).toBe('Видача');
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

  it('підтверджує закриття лише для зміненої незбереженої форми', () => {
    expect(shouldConfirmUnsavedDocument(true, false)).toBe(true);
    expect(shouldConfirmUnsavedDocument(false, false)).toBe(false);
    expect(shouldConfirmUnsavedDocument(true, true)).toBe(false);
  });
});
