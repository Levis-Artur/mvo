import type {
  InventoryItemAccountingCardQuery,
  InventoryItemCardDocument,
  InventoryItemMovement,
  InventoryItemMovementFilters,
  InventoryMovementCategory,
} from '@/lib/types';

export const EMPTY_MOVEMENT_FILTERS: InventoryItemMovementFilters = {
  dateFrom: '',
  dateTo: '',
  movementType: undefined,
  responsiblePersonId: '',
  documentNumber: '',
};

export function inventoryItemCardQuery(
  filters: InventoryItemMovementFilters,
  movementPage: number,
  movementLimit: number,
  documentPage: number,
  documentLimit: number,
): InventoryItemAccountingCardQuery {
  return {
    ...filters,
    movementPage: Math.max(1, movementPage),
    movementLimit: Math.min(100, Math.max(1, movementLimit)),
    documentPage: Math.max(1, documentPage),
    documentLimit: Math.min(100, Math.max(1, documentLimit)),
  };
}

export function movementTone(category: InventoryMovementCategory) {
  if (category === 'IMPORT' || category === 'MANUAL_RECEIPT') return 'success' as const;
  if (category === 'MVO_TRANSFER_REVERSAL' || category === 'ISSUE_REVERSAL') {
    return 'info' as const;
  }
  if (category === 'LEGACY') return 'neutral' as const;
  return 'warning' as const;
}

export function movementDisplayQuantity(movement: InventoryItemMovement) {
  return movement.quantity.startsWith('-') || movement.quantity === '0'
    ? movement.quantity
    : `+${movement.quantity}`;
}

export function inventoryDocumentHref(document: InventoryItemCardDocument) {
  return document.kind === 'IMPORT' ? `/imports/${document.id}` : null;
}

export function inventoryCardVisibleText(
  movement: InventoryItemMovement,
  document?: InventoryItemCardDocument,
) {
  return [
    movement.typeLabel,
    movement.from,
    movement.to,
    movement.documentNumber,
    movement.source,
    movement.user ?? '',
    document?.title ?? '',
    document?.typeLabel ?? '',
    document?.statusLabel ?? '',
  ].join(' ');
}
