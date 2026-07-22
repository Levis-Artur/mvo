import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AvailableStockSource } from '@/lib/types';
import { documentLineError, validateDocumentInput } from './stock-document-rules';
import {
  addSelectedStockSource,
  availableSourceOptions,
  documentLineSourceKey,
  filterStockSources,
  removeDocumentLine,
  sourceToDocumentLine,
  stockSourceKey,
} from './stock-source-picker-model';

function source(balanceId: string, quantity = '5'): AvailableStockSource {
  return {
    balanceId,
    inventoryItem: {
      id: 'item-1',
      externalCode: 'KB-001',
      name: 'Клавіатура провідна',
      unitOfMeasure: 'шт',
    },
    availableQuantity: quantity,
    unit: 'шт',
    canTransfer: true,
    canIssue: true,
  };
}

const direct = source('direct-balance');

describe('stock source picker model', () => {
  it('offers only positive direct balances and rejects a legacy ASSIGNED payload', () => {
    const assigned = {
      ...direct,
      balanceId: 'assigned-balance',
      sourceKind: 'ASSIGNED',
    } as AvailableStockSource;
    expect(availableSourceOptions([assigned, direct], [], 'MVO_TRANSFER')).toEqual([direct]);
    expect(availableSourceOptions([direct], [stockSourceKey(direct)], 'ISSUE')).toEqual([]);
    expect(availableSourceOptions([{ ...direct, availableQuantity: '0' }], [], 'ISSUE')).toEqual([]);
  });

  it.each([['кодом', 'kb-001'], ['назвою', 'клавіатура']])(
    'searches direct balances by %s',
    (_label, query) => {
      expect(filterStockSources([direct], [], query, 'MVO_TRANSFER')).toEqual([direct]);
    },
  );

  it('adds a row only after explicit confirmation and leaves quantity empty', () => {
    const confirmed = addSelectedStockSource([], direct);
    expect(confirmed).toEqual([{
      inventoryItemId: 'item-1',
      sourceBalanceId: 'direct-balance',
      quantity: '',
      note: '',
    }]);
  });

  it('does not add one balance twice and returns it after row removal', () => {
    const withDirect = addSelectedStockSource([], direct);
    expect(addSelectedStockSource(withDirect, direct)).toBe(withDirect);
    const removed = removeDocumentLine(withDirect, 0);
    expect(availableSourceOptions([direct], removed.map(documentLineSourceKey), 'MVO_TRANSFER')).toEqual([direct]);
  });

  it('blocks zero, negative and excessive quantities', () => {
    const row = sourceToDocumentLine(direct);
    expect(documentLineError({ ...row, quantity: '0' }, [direct])).toContain('більшою за 0');
    expect(documentLineError({ ...row, quantity: '-1' }, [direct])).toContain('більшою за 0');
    expect(documentLineError({ ...row, quantity: '6' }, [direct])).toContain('доступний залишок');
    expect(documentLineError({ ...row, quantity: '5' }, [direct])).toBe('');
  });

  it('rejects injected custody metadata outside the picker', () => {
    expect(validateDocumentInput({
      type: 'ISSUE',
      documentDate: '2026-07-20T00:00:00.000Z',
      sourceResponsiblePersonId: 'holder-1',
      recipientName: 'Одержувач',
      basis: 'Підстава',
      lines: [{
        inventoryItemId: 'item-1',
        sourceBalanceId: 'direct-balance',
        quantity: '1',
        sourceKind: 'ASSIGNED',
      }],
    }, [direct])).toBe('Для нового документа можна вибирати лише власний поточний залишок');
  });

  it('uses explicit confirmation and does not expose custody terminology', () => {
    const form = readFileSync(join(__dirname, 'stock-document-form.tsx'), 'utf8');
    const lines = readFileSync(join(__dirname, 'stock-document-lines.tsx'), 'utf8');
    const picker = readFileSync(join(__dirname, 'stock-source-picker-modal.tsx'), 'utf8');
    expect(lines).toContain('onClick={onAddRequest}');
    expect(lines).not.toMatch(/availableSourceOptions\([^)]*\)\[0\]/);
    expect(form).toContain('<StockSourcePickerModal');
    expect(form).toContain('onConfirm={(selectedSource) =>');
    expect(picker).toContain('title="Вибір майна"');
    expect(picker).toContain('Додати вибране');
    expect(picker).not.toContain('ASSIGNED');
    expect(picker).not.toContain('Обліковий власник');
  });

  it('renders loading, empty, API error, refresh and mobile overflow', () => {
    const picker = readFileSync(join(__dirname, 'stock-source-picker-modal.tsx'), 'utf8');
    const controller = readFileSync(join(__dirname, 'use-stock-documents-controller.ts'), 'utf8');
    const css = readFileSync(join(__dirname, '../../styles/components.css'), 'utf8');
    expect(picker).toContain('loading={loading}');
    expect(picker).toContain('<ErrorState message={error} />');
    expect(picker).toContain('Оновити список');
    expect(controller).toContain('await stockDocumentsService.availableToMe()');
    expect(controller).not.toContain('card.assignedToMe');
    expect(css).toContain('.stock-source-picker-table { min-width: 620px; }');
  });
});
