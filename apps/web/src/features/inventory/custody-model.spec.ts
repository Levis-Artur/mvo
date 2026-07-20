import type { AvailableStockSource, ResponsiblePersonAccountingCard } from '@/lib/types';
import {
  assignmentRecipientOwnBalanceChange,
  MY_STOCK_SECTION_LABELS,
  myStockSources,
} from './custody-model';

const direct = { sourceKind: 'DIRECT', sourceBalanceId: 'direct-1' } as AvailableStockSource;
const assigned = { sourceKind: 'ASSIGNED', sourceBalanceId: 'assigned-1' } as AvailableStockSource;
const card = {
  assignedToOthers: [{
    id: 'assigned-out-1',
    inventoryItem: { id: 'item-1' },
    accountingOwner: { id: 'owner-1' },
    custodian: { id: 'holder-2' },
    quantity: '2',
  }],
} as ResponsiblePersonAccountingCard;

describe('custody frontend model', () => {
  it('не змішує direct, assigned-out та assigned-to-me', () => {
    expect(myStockSources(card, [direct, assigned], 'direct')).toEqual([direct]);
    expect(myStockSources(card, [direct, assigned], 'assigned-to-me')).toEqual([assigned]);
    expect(myStockSources(card, [direct, assigned], 'assigned-out').map((item) => item.sourceBalanceId)).toEqual(['assigned-out-1']);
  });

  it('не називає assigned-to-me власним балансом', () => {
    expect(MY_STOCK_SECTION_LABELS['assigned-to-me']).toBe('Закріплено за мною');
    expect(MY_STOCK_SECTION_LABELS['assigned-to-me']).not.toContain('власний баланс');
  });

  it('передача-закріплення не збільшує власний balance одержувача', () => {
    expect(assignmentRecipientOwnBalanceChange()).toBe('0');
  });
});
