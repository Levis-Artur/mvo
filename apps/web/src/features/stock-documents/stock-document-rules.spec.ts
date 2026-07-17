import type {
  AuthUser,
  ResponsiblePerson,
  StockBalance,
  StockDocument,
  StockDocumentInput,
} from '@/lib/types';
import {
  availableBalanceOptions,
  canAddDocumentLine,
  canChangeStockDocuments,
  documentDirection,
  filterRecipientOptions,
  lifecycleActions,
  personOptionLabel,
  parseStockDocumentQuickAction,
  recipientOptions,
  resolveSourceId,
  validateDocumentInput,
} from './stock-document-rules';

const mvoUser = {
  id: 'user-1',
  username: 'mvo',
  role: 'MVO',
  responsiblePersonId: 'person-1',
} as AuthUser;
const auditor = { ...mvoUser, role: 'AUDITOR' } as AuthUser;
const person = (id: string, active = true) =>
  ({
    id,
    isActive: active,
    personnelNumber: id,
    lastName: id,
    firstName: 'Ім’я',
    middleName: null,
    management: { id: 'management-1', name: 'Управління забезпечення' },
  }) as ResponsiblePerson;
const balance = (id: string, quantity: string) =>
  ({ quantity, inventoryItem: { id, externalCode: id, name: id } }) as StockBalance;
const input = (patch: Partial<StockDocumentInput> = {}): StockDocumentInput => ({
  type: 'TRANSFER',
  documentDate: '2026-07-16T00:00:00.000Z',
  sourceResponsiblePersonId: 'person-1',
  destinationResponsiblePersonId: 'person-2',
  lines: [{ inventoryItemId: 'item-1', quantity: '2' }],
  ...patch,
});

describe('stock document frontend rules', () => {
  it('opens a quick action with the current MVO as source', () => {
    expect(
      parseStockDocumentQuickAction(
        '?create=TRANSFER&sourceResponsiblePersonId=person-1',
      ),
    ).toEqual({ type: 'TRANSFER', sourceResponsiblePersonId: 'person-1' });
    expect(
      parseStockDocumentQuickAction(
        '?create=ISSUE&sourceResponsiblePersonId=person-1',
      ),
    ).toEqual({ type: 'ISSUE', sourceResponsiblePersonId: 'person-1' });
  });

  it('MVO бачить дії створення', () => {
    expect(canChangeStockDocuments(mvoUser)).toBe(true);
  });

  it('AUDITOR не бачить кнопок зміни', () => {
    expect(canChangeStockDocuments(auditor)).toBe(false);
  });

  it('для MVO source завжди фіксований поточним МВО', () => {
    expect(resolveSourceId(mvoUser, 'another-person')).toBe('person-1');
  });

  it('OWNER і DPP можуть вибирати source', () => {
    expect(resolveSourceId({ role: 'OWNER', responsiblePersonId: null }, 'person-3')).toBe('person-3');
    expect(resolveSourceId({ role: 'DPP_ADMIN', responsiblePersonId: null }, 'person-4')).toBe('person-4');
  });

  it('не дозволяє вибрати самого себе одержувачем', () => {
    expect(recipientOptions([person('person-1'), person('person-2')], 'person-1').map((item) => item.id)).toEqual(['person-2']);
  });

  it('виключає неактивних одержувачів', () => {
    expect(recipientOptions([person('person-2', false)], 'person-1')).toEqual([]);
  });

  it('dropdown містить інших активних МВО з номером і ПІБ', () => {
    const options = recipientOptions(
      [person('003'), person('001'), person('002', false)],
      '001',
    );
    expect(options.map(personOptionLabel)).toEqual(['003 — 003 Ім’я']);
  });

  it('пошук одержувачів працює за номером, ПІБ та управлінням', () => {
    const arthur = {
      ...person('person-2'),
      personnelNumber: '003',
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: 'Сергійович',
    };
    expect(filterRecipientOptions([arthur], 'person-1', '003')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'левіс артур')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'забезпечення')).toEqual([arthur]);
  });

  it('номенклатура береться лише з позитивних залишків і без дублів', () => {
    expect(availableBalanceOptions([balance('a', '2'), balance('b', '0')], ['a'])).toEqual([]);
  });

  it('кнопка додавання активується після завантаження позитивних залишків', () => {
    expect(canAddDocumentLine([balance('a', '2')], [], true, false)).toBe(true);
    expect(canAddDocumentLine([balance('a', '0')], [], true, false)).toBe(false);
    expect(canAddDocumentLine([balance('a', '2')], [], true, true)).toBe(false);
  });

  it('не дозволяє кількість більшу за залишок', () => {
    expect(validateDocumentInput(input(), [balance('item-1', '1')])).toBe('Кількість не може перевищувати доступний залишок');
  });

  it('не дозволяє додати одну позицію двічі', () => {
    expect(validateDocumentInput(input({ lines: [
      { inventoryItemId: 'item-1', quantity: '1' },
      { inventoryItemId: 'item-1', quantity: '1' },
    ] }), [balance('item-1', '5')])).toBe('Номенклатуру не можна дублювати');
  });

  it('валідна чернетка проходить frontend validation', () => {
    expect(validateDocumentInput(input(), [balance('item-1', '5')])).toBe('');
  });

  it('TRANSFER вимагає МВО-одержувача', () => {
    expect(validateDocumentInput(input({ destinationResponsiblePersonId: undefined }), [balance('item-1', '5')])).toBe('Виберіть МВО-одержувача');
  });

  it('ISSUE вимагає зовнішнього одержувача, але не destination MVO', () => {
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: '' }), [balance('item-1', '5')])).toBe('Вкажіть одержувача');
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: 'Отримувач' }), [balance('item-1', '5')])).toBe('');
  });

  it('POSTED документ не редагується, але може бути скасований', () => {
    expect(lifecycleActions({ status: 'POSTED' }, mvoUser)).toEqual({ edit: false, post: false, remove: false, cancel: true });
  });

  it('MVO бачить окремі напрямки передачі та видачі', () => {
    const base = { type: 'TRANSFER', destinationResponsiblePersonId: 'person-1' } as StockDocument;
    expect(documentDirection(base, mvoUser)).toBe('Вхідна передача');
    expect(documentDirection({ ...base, destinationResponsiblePersonId: 'person-2' }, mvoUser)).toBe('Вихідна передача');
    expect(documentDirection({ ...base, type: 'ISSUE' }, mvoUser)).toBe('Видача');
  });
});
