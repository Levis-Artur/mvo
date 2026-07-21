import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MyPropertyItem } from '@/lib/types';
import {
  deliverDownloadedFile,
  exportSection,
  normalizedPropertySearch,
  MY_PROPERTY_SECTION_DESCRIPTIONS,
  MY_PROPERTY_SECTION_LABELS,
  myPropertySortOptions,
  propertyActionLinks,
} from './my-stock-model';

describe('my-stock frontend model', () => {
  it('normalizes search and maps export scope to ALL or current section', () => {
    expect(normalizedPropertySearch('  Клавіатура  ')).toBe('Клавіатура');
    expect(exportSection('ALL', 'ASSIGNED_TO_ME')).toBe('ALL');
    expect(exportSection('CURRENT', 'ASSIGNED_TO_ME')).toBe('ASSIGNED_TO_ME');
  });

  it('uses plain Ukrainian section names, explanations and sorting labels', () => {
    expect(MY_PROPERTY_SECTION_LABELS).toEqual({
      DIRECT: 'У мене',
      ASSIGNED_OUT: 'Передано іншим МВО',
      ASSIGNED_TO_ME: 'Отримано від інших МВО',
    });
    expect(MY_PROPERTY_SECTION_DESCRIPTIONS.DIRECT).toContain('безпосередньо у вас');
    expect(myPropertySortOptions('ASSIGNED_OUT')).toContainEqual({ value: 'currentCustodian', label: 'У кого знаходиться' });
    expect(myPropertySortOptions('ASSIGNED_TO_ME')).toContainEqual({ value: 'accountingOwner', label: 'Від кого отримано' });
  });

  it('keeps source balance identity in action links without mixing sections', () => {
    const item = {
      sourceBalanceId: 'balance/direct',
      sourceKind: 'DIRECT',
      currentCustodian: { id: 'holder/id' },
    } as MyPropertyItem;
    expect(propertyActionLinks(item)).toEqual({
      transfer: '/transfers?create=ASSIGNMENT&sourceResponsiblePersonId=holder%2Fid&sourceBalanceId=balance%2Fdirect&sourceKind=DIRECT',
      issue: '/transfers?create=ISSUE&sourceResponsiblePersonId=holder%2Fid&sourceBalanceId=balance%2Fdirect&sourceKind=DIRECT',
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

  it('releases the object URL even if browser download triggering fails', () => {
    const revoke = jest.fn();
    expect(() => deliverDownloadedFile(
      { blob: new Blob(['csv']), filename: 'file.csv' },
      {
        createObjectUrl: () => 'blob:file',
        triggerDownload: () => { throw new Error('browser failure'); },
        revokeObjectUrl: revoke,
      },
    )).toThrow('browser failure');
    expect(revoke).toHaveBeenCalledWith('blob:file');
  });

  it('wires debounce, page reset, sections, loading/error and mobile layout', () => {
    const view = readFileSync(join(__dirname, 'my-stock-view.tsx'), 'utf8');
    const modal = readFileSync(join(__dirname, 'my-stock-export-modal.tsx'), 'utf8');
    const css = readFileSync(join(__dirname, '../../styles/responsive.css'), 'utf8');

    expect(view).toContain('window.setTimeout(() =>');
    expect(view).toContain('}, 400);');
    expect(view).toContain('setPage(1);');
    expect(view).toContain("setSearchDraft('');");
    expect(view).toContain("setSearch('');");
    expect(view).toContain('section,');
    expect(view).toContain('limit: Math.min(limit, 100)');
    expect(view).toContain("if (exporting) return;");
    expect(view).toContain('Не вдалося експортувати CSV');
    expect(modal).toContain('Усе моє майно');
    expect(modal).toContain('Лише поточна вкладка');
    expect(css).toContain('.my-stock-toolbar { grid-template-columns: minmax(0, 1fr);');
  });

  it('keeps the simplified property flow without summary cards or an extra summary request', () => {
    const view = readFileSync(join(__dirname, 'my-stock-view.tsx'), 'utf8');
    const toolbarIndex = view.indexOf('className="my-stock-toolbar"');
    const tabsIndex = view.indexOf('aria-label="Склад майна"');
    const sortIndex = view.indexOf('className="my-stock-sort-bar"');
    const tableIndex = view.indexOf('<DataTable');

    expect(view).not.toContain('Разом під моїм обліком');
    expect(view).not.toContain('Фактично утримую');
    expect(view).not.toContain('const summary = data?.summary');
    expect(view).not.toContain('<Metric ');
    expect(view).not.toContain('function Metric(');
    expect(view).not.toContain('responsiblePersonAccountingCard');
    expect(view.match(/responsiblePersonsService\.myProperty\(/g)).toHaveLength(1);

    expect(toolbarIndex).toBeGreaterThan(-1);
    expect(tabsIndex).toBeGreaterThan(toolbarIndex);
    expect(sortIndex).toBeGreaterThan(tabsIndex);
    expect(tableIndex).toBeGreaterThan(sortIndex);
    expect(view).toContain('MY_PROPERTY_SECTION_LABELS');
    expect(view).toContain('setSection(item.id)');
    expect(view).toContain('responsiblePersonsService.exportMyPropertyCsv');
    expect(view).toContain('actionLinks.transfer');
    expect(view).toContain('actionLinks.issue');
    expect(view).not.toContain("{ label: 'Обліковий власник'");
    expect(view).not.toContain("{ label: 'Фактичний утримувач'");
    expect(view).not.toContain("{ label: 'Тип' }");
    expect(view).not.toContain("{ label: 'Доступно для передачі' }");
    expect(view).not.toContain("{ label: 'Доступно для видачі' }");
    expect(view).toContain("section === 'ASSIGNED_OUT'");
    expect(view).toContain("section === 'ASSIGNED_TO_ME'");
    expect(view).toContain('У вас немає майна, доступного для передачі або видачі.');
    expect(view).toContain('Ви ще не передавали майно іншим МВО.');
    expect(view).toContain('Інші МВО ще не передавали вам майно.');
  });
});
