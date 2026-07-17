import { isConfirmationValid } from './confirmation-model';
import { isTableActivationKey, resolveDataTableState } from './data-table-model';
import { hasVisibleApiError } from './feedback-model';
import { runFilterAction } from './filter-bar-model';
import { trappedFocusIndex } from './modal-focus-model';
import { normalizePageLimit, SUPPORTED_PAGE_LIMITS } from './pagination-model';

describe('shared working UI models', () => {
  it('DataTable розрізняє loading, empty та rows', () => {
    expect(resolveDataTableState(true, 0)).toBe('loading');
    expect(resolveDataTableState(false, 0)).toBe('empty');
    expect(resolveDataTableState(false, 2)).toBe('rows');
  });

  it('FilterBar викликає apply і reset лише за дією користувача', () => {
    const apply = jest.fn(); const reset = jest.fn();
    expect(apply).not.toHaveBeenCalled();
    runFilterAction(apply); runFilterAction(reset);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('Modal циклічно утримує focus всередині', () => {
    expect(trappedFocusIndex(0, 3, true)).toBe(2);
    expect(trappedFocusIndex(2, 3, false)).toBe(0);
    expect(trappedFocusIndex(1, 3, false)).toBe(2);
  });

  it('destructive confirmation вимагає точного тексту', () => {
    expect(isConfirmationValid('ВИДАЛИТИ', 'ВИДАЛИТИ')).toBe(true);
    expect(isConfirmationValid('видалити', 'ВИДАЛИТИ')).toBe(false);
  });

  it('Pagination не дозволяє limit понад 100', () => {
    expect(SUPPORTED_PAGE_LIMITS).toEqual([20, 50, 100]);
    expect(normalizePageLimit(500)).toBe(100);
  });

  it('API error залишається видимим користувачу', () => {
    expect(hasVisibleApiError('Помилка API')).toBe(true);
    expect(hasVisibleApiError('')).toBe(false);
  });

  it('keyboard navigation підтримує Enter і Space', () => {
    expect(isTableActivationKey('Enter')).toBe(true);
    expect(isTableActivationKey(' ')).toBe(true);
    expect(isTableActivationKey('Escape')).toBe(false);
  });
});
