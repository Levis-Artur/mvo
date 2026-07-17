import type { InventoryItem } from '../../lib/types';
import {
  inventoryItemStatuses,
  inventoryQueryFromFilters,
  inventoryViewState,
} from './inventory-model';

describe('nomenclature presentation model', () => {
  it('shows active, review and usage statuses', () => {
    const item = {
      isActive: false,
      reviewStatus: 'NEEDS_REVIEW',
      responsiblePersonsCount: 2,
    } as InventoryItem;
    expect(inventoryItemStatuses(item)).toEqual({
      active: 'Архівна',
      needsReview: 'Потребує перевірки',
      used: true,
    });
  });

  it('keeps API pagination at or below 100', () => {
    expect(
      inventoryQueryFromFilters(
        { search: '', reviewStatus: '', isActive: '' },
        1,
        500,
      ).limit,
    ).toBe(100);
  });

  it('distinguishes loading, empty, error and rows states', () => {
    expect(inventoryViewState(true, '', 0)).toBe('loading');
    expect(inventoryViewState(false, '', 0)).toBe('empty');
    expect(inventoryViewState(false, 'Помилка API', 0)).toBe('error');
    expect(inventoryViewState(false, '', 1)).toBe('rows');
  });
});
