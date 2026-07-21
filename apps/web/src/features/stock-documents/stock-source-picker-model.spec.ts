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
  stockSourceKindLabel,
} from './stock-source-picker-model';

function source({
  kind,
  balanceId,
  itemId = 'item-1',
  code,
  name,
  ownerId,
  ownerName,
  quantity = '5',
  canAssign = true,
  canIssue = true,
}: {
  kind: 'DIRECT' | 'ASSIGNED';
  balanceId: string;
  itemId?: string;
  code: string;
  name: string;
  ownerId: string;
  ownerName: string;
  quantity?: string;
  canAssign?: boolean;
  canIssue?: boolean;
}): AvailableStockSource {
  return {
    sourceKind: kind,
    sourceBalanceId: balanceId,
    inventoryItem: { id: itemId, externalCode: code, name, unitOfMeasure: 'шт' },
    accountingOwner: { id: ownerId, personnelNumber: ownerId, fullName: ownerName },
    currentCustodian: { id: 'holder-1', personnelNumber: '007', fullName: 'Поточний Утримувач' },
    availableQuantity: quantity,
    canAssign,
    canIssue,
  };
}

const direct = source({
  kind: 'DIRECT',
  balanceId: 'direct-balance',
  code: 'KB-001',
  name: 'Клавіатура провідна',
  ownerId: 'holder-1',
  ownerName: 'Андрій Власник',
});
const assigned = source({
  kind: 'ASSIGNED',
  balanceId: 'assigned-balance',
  code: 'KB-001',
  name: 'Клавіатура провідна',
  ownerId: 'owner-assigned',
  ownerName: 'Богдан Обліковий',
  quantity: '3.5',
});

describe('stock source picker model', () => {
  it('keeps DIRECT and ASSIGNED sources of one item separate', () => {
    expect(stockSourceKey(direct)).toBe('DIRECT:direct-balance');
    expect(stockSourceKey(assigned)).toBe('ASSIGNED:assigned-balance');
    expect(availableSourceOptions(
      [direct, assigned],
      [stockSourceKey(direct)],
      'ASSIGNMENT',
    )).toEqual([assigned]);
  });

  it('keeps technical source kinds in state but presents plain labels', () => {
    expect(stockSourceKindLabel('DIRECT')).toBe('У мене');
    expect(stockSourceKindLabel('ASSIGNED')).toBe('Отримано від іншого МВО');
  });

  it('shows every permitted positive DIRECT and ASSIGNED source', () => {
    expect(filterStockSources([assigned, direct], [], '', 'ALL', 'ASSIGNMENT'))
      .toEqual(expect.arrayContaining([direct, assigned]));
    expect(filterStockSources([direct, assigned], [], '', 'DIRECT', 'ISSUE'))
      .toEqual([direct]);
    expect(filterStockSources([direct, assigned], [], '', 'ASSIGNED', 'ISSUE'))
      .toEqual([assigned]);
  });

  it.each([
    ['кодом', 'kb-001'],
    ['назвою', 'клавіатура'],
    ['номером власника', 'owner-assigned'],
    ['ПІБ облікового власника', 'богдан обліковий'],
  ])('searches by %s', (_label, query) => {
    expect(filterStockSources([assigned], [], query, 'ALL', 'ISSUE')).toEqual([assigned]);
  });

  it('adds a row only after explicit selection and leaves quantity empty', () => {
    const initial: ReturnType<typeof sourceToDocumentLine>[] = [];
    expect(initial).toHaveLength(0);
    const confirmed = addSelectedStockSource(initial, direct);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]).toMatchObject({
      inventoryItemId: direct.inventoryItem.id,
      sourceKind: 'DIRECT',
      sourceBalanceId: 'direct-balance',
      quantity: '',
    });
  });

  it('does not add one source twice and returns it after row removal', () => {
    const withDirect = addSelectedStockSource([], direct);
    expect(addSelectedStockSource(withDirect, direct)).toBe(withDirect);
    const removed = removeDocumentLine(withDirect, 0);
    expect(removed).toEqual([]);
    expect(availableSourceOptions([direct], removed.map(documentLineSourceKey))).toEqual([direct]);
  });

  it('blocks zero, negative and excessive quantities', () => {
    const line = sourceToDocumentLine(direct);
    expect(documentLineError({ ...line, quantity: '0' }, [direct])).toContain('більшою за 0');
    expect(documentLineError({ ...line, quantity: '-1' }, [direct])).toContain('більшою за 0');
    expect(documentLineError({ ...line, quantity: '6' }, [direct])).toContain('доступний залишок');
    expect(documentLineError({ ...line, quantity: '5' }, [direct])).toBe('');
  });

  it('allows one nomenclature from distinct accounting-owner sources', () => {
    const directLine = { ...sourceToDocumentLine(direct), quantity: '1' };
    const assignedLine = { ...sourceToDocumentLine(assigned), quantity: '1' };
    expect(validateDocumentInput({
      type: 'ASSIGNMENT',
      documentDate: '2026-07-20T00:00:00.000Z',
      sourceResponsiblePersonId: 'holder-1',
      destinationResponsiblePersonId: 'holder-2',
      lines: [directLine, assignedLine],
    }, [direct, assigned])).toBe('');
  });

  it('uses one shared modal for ASSIGNMENT and ISSUE without automatic first-item insertion', () => {
    const form = readFileSync(join(__dirname, 'stock-document-form.tsx'), 'utf8');
    const lines = readFileSync(join(__dirname, 'stock-document-lines.tsx'), 'utf8');
    const picker = readFileSync(join(__dirname, 'stock-source-picker-modal.tsx'), 'utf8');

    expect(lines).toContain('onClick={onAddRequest}');
    expect(lines).not.toMatch(/availableSourceOptions\([^)]*\)\[0\]/);
    expect(form).toContain('<StockSourcePickerModal');
    expect(form).toContain('type={type}');
    expect(form).toContain('simplified={simplified}');
    expect(form).toContain('onConfirm={(selectedSource) =>');
    expect(form).toContain('onClose={() => setSourcePickerOpen(false)}');
    expect(picker).toContain('title="Вибір майна"');
    expect(picker).toContain('Додати вибране');
    expect(picker).toContain("source.sourceKind === 'DIRECT' ? 'У вас'");
    expect(form).not.toContain('initialSourceAdded.current');
    expect(form).not.toContain('initialSourceBalanceId');
    expect(picker).not.toContain('initialSourceBalanceId');
    expect(form).toContain('quantity:');
  });

  it('renders loading, empty, API error, refresh and controlled mobile overflow', () => {
    const picker = readFileSync(join(__dirname, 'stock-source-picker-modal.tsx'), 'utf8');
    const controller = readFileSync(join(__dirname, 'use-stock-documents-controller.ts'), 'utf8');
    const componentsCss = readFileSync(join(__dirname, '../../styles/components.css'), 'utf8');
    const responsiveCss = readFileSync(join(__dirname, '../../styles/responsive.css'), 'utf8');

    expect(picker).toContain('loading={loading}');
    expect(picker).toContain('<ErrorState message={error} />');
    expect(picker).toContain('emptyMessage=');
    expect(picker).toContain('Оновити список');
    expect(controller).toContain('await stockDocumentsService.availableToMe()');
    expect(componentsCss).toContain('.stock-source-picker-table { min-width: 980px; }');
    expect(componentsCss).toContain('.stock-source-picker-table--mvo { min-width: 760px; }');
    expect(componentsCss).toContain('.data-table-scroll { max-width: 100%;');
    expect(responsiveCss).toContain('.stock-source-picker__filters { grid-template-columns: minmax(0, 1fr);');
  });
});
