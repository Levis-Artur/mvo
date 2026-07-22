import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deliverDownloadedFile,
  exportSection,
  MY_PROPERTY_SECTION_DESCRIPTIONS,
  MY_PROPERTY_SECTION_LABELS,
  myPropertySortOptions,
  normalizedPropertySearch,
} from './my-stock-model';

describe('my-stock frontend model', () => {
  it('normalizes search and maps export scope to all or current section', () => {
    expect(normalizedPropertySearch('  Клавіатура  ')).toBe('Клавіатура');
    expect(exportSection('ALL', 'TRANSFERRED')).toBe('ALL');
    expect(exportSection('CURRENT', 'TRANSFERRED')).toBe('TRANSFERRED');
  });

  it('exposes exactly direct balances and document transfer history', () => {
    expect(MY_PROPERTY_SECTION_LABELS).toEqual({
      DIRECT: 'У мене',
      TRANSFERRED: 'Передано іншим МВО',
    });
    expect(MY_PROPERTY_SECTION_LABELS).not.toHaveProperty('ASSIGNED_TO_ME');
    expect(MY_PROPERTY_SECTION_DESCRIPTIONS.DIRECT).toContain(
      'Поточний залишок',
    );
    expect(myPropertySortOptions('TRANSFERRED')).toContainEqual({
      value: 'recipient',
      label: 'Кому передано',
    });
  });

  it('downloads a Blob and always revokes the object URL', () => {
    const calls: string[] = [];
    deliverDownloadedFile(
      { blob: new Blob(['csv']), filename: 'mvo-property.csv' },
      {
        createObjectUrl: () => 'blob:mvo-property',
        triggerDownload: (url, filename) => calls.push(`${url}:${filename}`),
        revokeObjectUrl: (url) => calls.push(`revoke:${url}`),
      },
    );
    expect(calls).toEqual([
      'blob:mvo-property:mvo-property.csv',
      'revoke:blob:mvo-property',
    ]);
  });

  it('releases the object URL if browser download triggering fails', () => {
    const revoke = jest.fn();
    expect(() =>
      deliverDownloadedFile(
        { blob: new Blob(['csv']), filename: 'file.csv' },
        {
          createObjectUrl: () => 'blob:file',
          triggerDownload: () => {
            throw new Error('browser failure');
          },
          revokeObjectUrl: revoke,
        },
      ),
    ).toThrow('browser failure');
    expect(revoke).toHaveBeenCalledWith('blob:file');
  });

  it('keeps search, CSV export, pagination, loading, and mobile layout', () => {
    const view = readFileSync(join(__dirname, 'my-stock-view.tsx'), 'utf8');
    const modal = readFileSync(
      join(__dirname, 'my-stock-export-modal.tsx'),
      'utf8',
    );
    const css = readFileSync(
      join(__dirname, '../../styles/responsive.css'),
      'utf8',
    );

    expect(view).toContain('window.setTimeout(() =>');
    expect(view).toContain('}, 400);');
    expect(view).toContain('limit: Math.min(limit, 100)');
    expect(view).toContain('responsiblePersonsService.exportMyPropertyCsv');
    expect(view).toContain('<Pagination');
    expect(view).toContain('loading={loading}');
    expect(view).toContain('Не вдалося експортувати CSV');
    expect(modal).toContain('Усе моє майно');
    expect(modal).toContain('Лише поточна вкладка');
    expect(css).toContain(
      '.my-stock-toolbar { grid-template-columns: minmax(0, 1fr);',
    );
  });

  it('contains no received-from-others tab, custody state, or summary request', () => {
    const view = readFileSync(join(__dirname, 'my-stock-view.tsx'), 'utf8');
    const model = readFileSync(join(__dirname, 'my-stock-model.ts'), 'utf8');
    const types = readFileSync(join(__dirname, '../../lib/types.ts'), 'utf8');

    expect(view).not.toContain('Отримано від інших МВО');
    expect(view).not.toContain('Закріплено за мною');
    expect(view).not.toContain('ASSIGNED_TO_ME');
    expect(model).not.toContain('ASSIGNED_TO_ME');
    expect(types).not.toContain("'DIRECT' | 'ASSIGNED_OUT' | 'ASSIGNED_TO_ME'");
    expect(view).not.toContain('responsiblePersonAccountingCard');
    expect(view.match(/responsiblePersonsService\.myProperty\(/g)).toHaveLength(
      1,
    );
    expect(view).toContain("section === 'TRANSFERRED'");
  });

  it('renders direct stock and transfer-document history as read-only tables', () => {
    const view = readFileSync(join(__dirname, 'my-stock-view.tsx'), 'utf8');
    const css = readFileSync(
      join(__dirname, '../../styles/components.css'),
      'utf8',
    );

    expect(view).not.toContain("{ label: 'Дії'");
    expect(view).not.toContain('sourceBalanceId');
    expect(view).not.toContain('accountingOwner');
    expect(view).not.toContain('currentCustodian');
    expect(view).toContain("{ label: 'Код', className: 'my-stock-table__code' }");
    expect(view).toContain("{ label: 'Дата', className: 'my-stock-table__date' }");
    expect(view).toContain("{ label: 'Номер', className: 'my-stock-table__document' }");
    expect(view).toContain("{ label: 'Кому передано', className: 'my-stock-table__person' }");
    expect(view).toContain('<StockDocumentStatusBadge');
    expect(css).toContain(
      '.my-stock-table--transferred { min-width: 900px; }',
    );
    expect(css).not.toContain('.my-stock-table--assigned_to_me');
    expect(css).toContain(
      '.data-table-scroll { max-width: 100%; max-height: 560px; overflow: auto; }',
    );
  });
});
