import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canUseGlobalResponsiblePersonFilters,
  shouldLoadGlobalResponsiblePersons,
} from './stock-document-loading-policy';

describe('stock document lazy loading policy', () => {
  it('does not load the administrative responsible-person registry for MVO', () => {
    expect(shouldLoadGlobalResponsiblePersons('MVO')).toBe(false);
    expect(canUseGlobalResponsiblePersonFilters('MVO')).toBe(false);
    expect(shouldLoadGlobalResponsiblePersons('OWNER')).toBe(true);
    expect(canUseGlobalResponsiblePersonFilters('OWNER')).toBe(true);
  });

  it('loads transfer targets only when the MVO_TRANSFER form is opened', () => {
    const view = readFileSync(
      join(__dirname, 'stock-documents-view.tsx'),
      'utf8',
    );
    const controller = readFileSync(
      join(__dirname, 'use-stock-documents-controller.ts'),
      'utf8',
    );

    expect(view).toContain('controller.targetsError');
    expect(view).toContain('controller.transferTargets');
    expect(view).toContain('controller.loadingTargets');
    expect(view).not.toContain(
      '<ErrorState message={controller.personsError}',
    );
    expect(controller).toContain("if (nextType === 'MVO_TRANSFER') void loadTargets();");
    expect(controller).toContain('loadTransferTargets(stockDocumentsService.transferTargets)');
    expect(controller).not.toContain('card.assignedToMe');
    expect(controller).toContain("if (nextType !== 'ISSUE' && nextType !== 'MVO_TRANSFER') return;");
    expect(controller).toContain('void loadSources(source);');
    expect(controller).not.toMatch(/useEffect\(\(\) => \{ void loadSources\(/);
  });

  it('creates MVO_TRANSFER while keeping legacy transfers read-only', () => {
    const view = readFileSync(join(__dirname, 'stock-documents-view.tsx'), 'utf8');
    const details = readFileSync(join(__dirname, 'stock-document-details-modal.tsx'), 'utf8');
    const rules = readFileSync(join(__dirname, 'stock-document-rules.ts'), 'utf8');

    expect(view).toContain("controller.openCreate('MVO_TRANSFER')");
    expect(view).toContain('Передача (стара логіка)');
    expect(details).toContain("document.type === 'TRANSFER' || document.type === 'ASSIGNMENT'");
    expect(details).toContain('доступний лише для перегляду');
    expect(rules).toContain("document.type === 'ISSUE' || document.type === 'MVO_TRANSFER'");
  });

  it('uses a compact MVO list without technical status labels', () => {
    const view = readFileSync(join(__dirname, 'stock-documents-view.tsx'), 'utf8');
    const table = readFileSync(join(__dirname, 'stock-documents-table.tsx'), 'utf8');
    const details = readFileSync(join(__dirname, 'stock-document-details-modal.tsx'), 'utf8');

    expect(view).toContain('<option value="DRAFT">Чернетки</option>');
    expect(view).toContain('<option value="POSTED">Проведені</option>');
    expect(view).toContain('<option value="CANCELLED">Скасовані</option>');
    expect(table).toContain("if (user.role === 'MVO')");
    expect(table).toContain("documentTypeLabel(document.type)");
    expect(table).toContain('documentNumberLabel(document.displayNumber)');
    expect(details).toContain("user.role === 'MVO' ? [");
  });

  it('renders sequential numbers and a compact document table without exposing legacy identifiers', () => {
    const view = readFileSync(join(__dirname, 'stock-documents-view.tsx'), 'utf8');
    const table = readFileSync(join(__dirname, 'stock-documents-table.tsx'), 'utf8');
    const form = readFileSync(join(__dirname, 'stock-document-form.tsx'), 'utf8');
    const css = readFileSync(join(__dirname, '../../styles/components.css'), 'utf8');
    const mvoStart = table.indexOf("if (user.role === 'MVO')");
    const mvoEnd = table.indexOf('\n  return <DataTable', mvoStart);
    const mvoTable = table.slice(mvoStart, mvoEnd);

    expect(table).toContain('documentNumberLabel(document.displayNumber)');
    expect(table).not.toContain('>{document.documentNumber}<');
    expect(mvoTable).toContain("{ label: 'Документ', className: 'stock-documents-table__document' }");
    expect(mvoTable).toContain("{ label: 'Кому / від кого', className: 'stock-documents-table__person' }");
    expect(mvoTable).toContain("{ label: 'Обсяг', className: 'stock-documents-table__volume' }");
    expect(mvoTable).not.toContain("{ label: 'Тип'");
    expect(mvoTable).not.toContain("{ label: 'Номер'");
    expect(mvoTable).not.toContain("{ label: 'Позицій'");
    expect(mvoTable).not.toContain("{ label: 'Загальна кількість'");
    expect(mvoTable).toContain('className="stock-document-summary"');
    expect(mvoTable).toContain('documentTypeLabel(document.type)');
    expect(mvoTable).toContain('documentNumberLabel(document.displayNumber)');
    expect(mvoTable).toContain('documentVolumePresentation(document.totalPositions, document.totalQuantity)');
    expect(table).toContain('className="stock-document-actions stock-document-actions--mvo"');
    expect(table).toContain('size="compact" title="Переглянути документ"');
    expect(table).toContain('actions.cancel ? <Button size="compact" title="Скасувати документ"');
    expect(table).toContain('onClick={() => onView(document)}');
    expect(table).toContain('onClick={() => onCancel(document)}');
    expect(form).not.toContain('documentNumberLabel(document.displayNumber)');
    expect(form).not.toContain('setDocumentNumber');
    expect(view).toContain('stock-documents-page--mvo');
    expect(view).toContain('onApply={() => {');
    expect(view).toContain('onReset={() => {');
    expect(view).toContain('onRefresh={() => void controller.load()}');

    expect(css).toContain('.stock-documents-page { width: min(100%, 1440px); margin-inline: auto; }');
    expect(css).toContain('.stock-documents-page--mvo .filter-bar > .filter-bar__field:first-child { flex: 1 1 360px; }');
    expect(css).toContain('.stock-documents-table--mvo { width: 100%; min-width: 1040px; table-layout: fixed; }');
    expect(css).toContain('.stock-documents-table__date { width: 116px; white-space: nowrap; }');
    expect(css).toContain('.stock-documents-table__document { width: 210px; white-space: nowrap; }');
    expect(css).toContain('.stock-documents-table__volume { width: 150px; white-space: nowrap;');
    expect(css).toContain('.stock-documents-table__status { width: 140px; white-space: nowrap; }');
    expect(css).toContain('.stock-documents-table__actions { width: 230px; white-space: nowrap; }');
    expect(css).toContain('.stock-document-actions--mvo { flex-wrap: nowrap; gap: var(--space-2); }');
    expect(css).toContain('.data-table-scroll { max-width: 100%; max-height: 560px; overflow: auto; }');
    expect(css).toContain('text-overflow: ellipsis; white-space: nowrap;');
  });

  it('hides dates behind additional filters and renders human success actions', () => {
    const view = readFileSync(join(__dirname, 'stock-documents-view.tsx'), 'utf8');
    const form = readFileSync(join(__dirname, 'stock-document-form.tsx'), 'utf8');
    const success = readFileSync(join(__dirname, 'document-success-modal.tsx'), 'utf8');

    expect(view).toContain('advancedFilters');
    expect(view).toContain('Додаткові фільтри');
    expect(form).toContain('Ви внесли дані, але ще не зберегли чернетку.');
    expect(form).toContain('Продовжити заповнення');
    expect(form).toContain('Закрити без збереження');
    expect(success).toContain('Чернетку збережено. Ви можете повернутися до неї пізніше або провести документ зараз.');
    expect(success).toContain('Переглянути документ');
    expect(success).toContain('Повернутися до мого майна');
    expect(success).not.toContain('requestId');
  });
});
