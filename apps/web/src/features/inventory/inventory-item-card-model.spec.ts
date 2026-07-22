import type { InventoryItemCardDocument, InventoryItemMovement } from '@/lib/types';
import {
  inventoryCardVisibleText,
  inventoryDocumentHref,
  inventoryItemCardQuery,
  movementDisplayQuantity,
} from './inventory-item-card-model';

const movement = {
  id: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-07-22T10:00:00.000Z',
  category: 'MVO_TRANSFER',
  typeLabel: 'Передача між МВО',
  from: '001 — Левіс Артур',
  to: '003 — Луцик Володимир',
  quantity: '-2',
  balanceBefore: '10',
  balanceAfter: '8',
  documentNumber: '№ 7',
  source: 'Документ № 7',
  user: 'mvo-a',
  responsiblePerson: {
    id: 'person-1',
    fullName: 'Левіс Артур',
    personnelNumber: '001',
    management: { id: 'm-1', name: 'Управління' },
    service: { id: 's-1', name: 'Служба' },
    unit: null,
  },
  documentId: 'document-1',
  importBatchId: null,
} satisfies InventoryItemMovement;

describe('inventory item accounting card model', () => {
  it('never requests more than 100 rows for either paginated collection', () => {
    expect(inventoryItemCardQuery({}, 1, 500, 1, 300)).toEqual(
      expect.objectContaining({ movementLimit: 100, documentLimit: 100 }),
    );
  });

  it('keeps transfer quantity negative and receipt quantity visibly positive', () => {
    expect(movementDisplayQuantity(movement)).toBe('-2');
    expect(
      movementDisplayQuantity({ ...movement, category: 'IMPORT', quantity: '5' }),
    ).toBe('+5');
  });

  it('opens imports by their route and stock documents through the details flow', () => {
    const importDocument = {
      kind: 'IMPORT',
      id: 'import-1',
    } as InventoryItemCardDocument;
    const stockDocument = {
      kind: 'STOCK_DOCUMENT',
      id: 'document-1',
    } as InventoryItemCardDocument;
    expect(inventoryDocumentHref(importDocument)).toBe('/imports/import-1');
    expect(inventoryDocumentHref(stockDocument)).toBeNull();
  });

  it('does not include technical ids or storage concepts in visible text', () => {
    const visible = inventoryCardVisibleText(movement);
    expect(visible).not.toContain(movement.id);
    expect(visible).not.toMatch(/DIRECT|ASSIGNED|LEGACY|requestId/);
  });
});
