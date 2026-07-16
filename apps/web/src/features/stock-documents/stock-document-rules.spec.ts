import type {
  AuthUser,
  ResponsiblePerson,
  StockBalance,
  StockDocument,
  StockDocumentInput,
} from '@/lib/types';
import {
  availableBalanceOptions,
  canChangeStockDocuments,
  documentDirection,
  lifecycleActions,
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
  ({ id, isActive: active, lastName: id, firstName: 'Ім’я' }) as ResponsiblePerson;
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

  it('номенклатура береться лише з позитивних залишків і без дублів', () => {
    expect(availableBalanceOptions([balance('a', '2'), balance('b', '0')], ['a'])).toEqual([]);
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
