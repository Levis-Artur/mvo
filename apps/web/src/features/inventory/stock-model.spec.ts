import type { StockBalance } from '../../lib/types';
import {
  allowsDirectBalanceEditing,
  filterProblematicBalances,
  mvoStockActionLinks,
  paginateBalances,
  stockQueryFromFilters,
  stockScope,
} from './stock-model';

const balances = [
  { id: 'b-1', quantity: '3.5' },
  { id: 'b-2', quantity: '0' },
] as StockBalance[];

describe('stock presentation model', () => {
  it('applies the positive-only filter through the API query', () => {
    expect(stockQueryFromFilters({ onlyPositive: true }).onlyPositive).toBe(true);
    expect(filterProblematicBalances(balances, true)).toEqual([balances[1]]);
  });

  it('forces MVO scope and keeps OWNER-selected scope', () => {
    expect(stockScope('MVO', 'person-own', 'person-other')).toBe('person-own');
    expect(stockScope('OWNER', null, 'person-other')).toBe('person-other');
  });

  it('does not expose direct balance editing', () => {
    expect(allowsDirectBalanceEditing()).toBe(false);
  });

  it('builds transfer and issue links for the current MVO', () => {
    expect(mvoStockActionLinks('person-1')).toEqual({
      transfer: '/transfers?create=TRANSFER&sourceResponsiblePersonId=person-1',
      issue: '/transfers?create=ISSUE&sourceResponsiblePersonId=person-1',
    });
  });

  it('never creates a page limit greater than 100', () => {
    expect(paginateBalances(balances, 1, 500).pagination.limit).toBe(100);
  });
});
