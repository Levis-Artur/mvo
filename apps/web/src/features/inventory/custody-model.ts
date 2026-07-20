import type {
  AvailableStockSource,
  ResponsiblePersonAccountingCard,
} from '@/lib/types';

export type MyStockSection = 'direct' | 'assigned-out' | 'assigned-to-me';

export const MY_STOCK_SECTION_LABELS: Record<MyStockSection, string> = {
  direct: 'Безпосередньо у мене',
  'assigned-out': 'Закріплено за іншими',
  'assigned-to-me': 'Закріплено за мною',
};

export function myStockSources(
  card: ResponsiblePersonAccountingCard,
  available: AvailableStockSource[],
  section: MyStockSection,
): AvailableStockSource[] {
  if (section === 'direct') {
    return available.filter((item) => item.sourceKind === 'DIRECT');
  }
  if (section === 'assigned-to-me') {
    return available.filter((item) => item.sourceKind === 'ASSIGNED');
  }
  return card.assignedToOthers.map((item) => ({
    sourceKind: 'ASSIGNED',
    inventoryItem: item.inventoryItem,
    accountingOwner: item.accountingOwner,
    currentCustodian: item.custodian,
    availableQuantity: item.quantity,
    sourceBalanceId: item.id,
    canAssign: false,
    canIssue: false,
  }));
}

export function assignmentRecipientOwnBalanceChange() {
  return '0';
}
