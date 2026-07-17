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
  documentActionState,
  documentDirection,
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

const mvoUser = {
  id: 'user-1', username: 'mvo', role: 'MVO', responsiblePersonId: 'person-1',
} as AuthUser;
const auditor = { ...mvoUser, role: 'AUDITOR' } as AuthUser;
const person = (id: string, active = true) => ({
  id, isActive: active, personnelNumber: id, lastName: id, firstName: 'Ім’я', middleName: null,
  management: { id: 'management-1', name: 'Управління забезпечення' },
}) as ResponsiblePerson;
const balance = (id: string, quantity: string) => ({
  quantity, inventoryItem: { id, externalCode: id, name: id },
}) as StockBalance;
const input = (patch: Partial<StockDocumentInput> = {}): StockDocumentInput => ({
  type: 'TRANSFER', documentDate: '2026-07-16T00:00:00.000Z',
  sourceResponsiblePersonId: 'person-1', destinationResponsiblePersonId: 'person-2',
  lines: [{ inventoryItemId: 'item-1', quantity: '2' }], ...patch,
});

describe('stock document frontend rules', () => {
  it('відкриває quick action із переданим МВО-відправником', () => {
    expect(parseStockDocumentQuickAction('?create=TRANSFER&sourceResponsiblePersonId=person-1'))
      .toEqual({ type: 'TRANSFER', sourceResponsiblePersonId: 'person-1' });
  });

  it('AUDITOR має read-only UI, а MVO може створювати власні документи', () => {
    expect(canChangeStockDocuments(mvoUser)).toBe(true);
    expect(canChangeStockDocuments(auditor)).toBe(false);
  });

  it('MVO не може підмінити source', () => {
    expect(resolveSourceId(mvoUser, 'another-person')).toBe('person-1');
  });

  it('OWNER і DPP можуть вибирати source', () => {
    expect(resolveSourceId({ role: 'OWNER', responsiblePersonId: null }, 'person-3')).toBe('person-3');
    expect(resolveSourceId({ role: 'DPP_ADMIN', responsiblePersonId: null }, 'person-4')).toBe('person-4');
  });

  it('виключає відправника і неактивних МВО, але показує іншого МВО', () => {
    expect(recipientOptions([person('001'), person('003'), person('004', false)], '001').map((item) => item.id))
      .toEqual(['003']);
    expect(personOptionLabel(person('003'))).toBe('003 — 003 Ім’я — Управління забезпечення');
  });

  it('шукає transfer target за номером, ПІБ та управлінням', () => {
    const arthur = { ...person('person-2'), personnelNumber: '003', lastName: 'Левіс', firstName: 'Артур', middleName: 'Сергійович' };
    expect(filterRecipientOptions([arthur], 'person-1', '003')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'левіс артур')).toEqual([arthur]);
    expect(filterRecipientOptions([arthur], 'person-1', 'забезпечення')).toEqual([arthur]);
  });

  it('ISSUE використовує зовнішнього одержувача, TRANSFER — МВО', () => {
    expect(documentRecipientMode('ISSUE')).toBe('EXTERNAL');
    expect(documentRecipientMode('TRANSFER')).toBe('MVO');
  });

  it('додає лише позиції з позитивних залишків без дублів', () => {
    expect(availableBalanceOptions([balance('a', '2'), balance('b', '0')], ['a'])).toEqual([]);
    expect(canAddDocumentLine([balance('a', '2')], [], true, false)).toBe(true);
    expect(canAddDocumentLine([balance('a', '2')], [], true, true)).toBe(false);
  });

  it('забороняє кількість понад залишок', () => {
    expect(validateDocumentInput(input(), [balance('item-1', '1')]))
      .toBe('Кількість не може перевищувати доступний залишок');
  });

  it('перевіряє специфічні поля TRANSFER та ISSUE', () => {
    expect(validateDocumentInput(input({ destinationResponsiblePersonId: undefined }), [balance('item-1', '5')]))
      .toBe('Виберіть МВО-одержувача');
    expect(validateDocumentInput(input({ type: 'ISSUE', destinationResponsiblePersonId: undefined, recipientName: '' }), [balance('item-1', '5')]))
      .toBe('Вкажіть одержувача');
  });

  it('POSTED не редагується, але може бути скасований', () => {
    expect(lifecycleActions({ status: 'POSTED', sourceResponsiblePersonId: 'person-1' }, mvoUser))
      .toEqual({ edit: false, post: false, remove: false, cancel: true });
  });

  it('CANCELLED доступний лише для перегляду', () => {
    expect(lifecycleActions({ status: 'CANCELLED', sourceResponsiblePersonId: 'person-1' }, mvoUser))
      .toEqual({ edit: false, post: false, remove: false, cancel: false });
  });

  it('вхідний документ для MVO має read-only дії', () => {
    expect(lifecycleActions({ status: 'DRAFT', sourceResponsiblePersonId: 'person-2' }, mvoUser))
      .toEqual({ edit: false, post: false, remove: false, cancel: false });
  });

  it('показує точний cancel error у стані modal', () => {
    expect(documentActionState('Недостатній залишок для reversal', false).error)
      .toBe('Недостатній залишок для reversal');
  });

  it('відрізняє вхідну, вихідну передачу та видачу', () => {
    const document = { type: 'TRANSFER', destinationResponsiblePersonId: 'person-1' } as StockDocument;
    expect(documentDirection(document, mvoUser)).toBe('Вхідна передача');
    expect(documentDirection({ ...document, destinationResponsiblePersonId: 'person-2' }, mvoUser)).toBe('Вихідна передача');
    expect(documentDirection({ ...document, type: 'ISSUE' }, mvoUser)).toBe('Видача');
  });

  it('оформлює DRAFT, POSTED і CANCELLED через стабільні статуси', () => {
    expect(documentStatusPresentation('DRAFT').label).toBe('DRAFT');
    expect(documentStatusPresentation('POSTED').tone).toBe('success');
    expect(documentStatusPresentation('CANCELLED').tone).toBe('neutral');
  });
});
