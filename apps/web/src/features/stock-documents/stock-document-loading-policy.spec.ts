import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canUseGlobalResponsiblePersonFilters,
  formLoadPolicy,
  shouldLoadGlobalResponsiblePersons,
} from './stock-document-loading-policy';

describe('stock document lazy loading policy', () => {
  it('does not load the administrative responsible-person registry for MVO', () => {
    expect(shouldLoadGlobalResponsiblePersons('MVO')).toBe(false);
    expect(canUseGlobalResponsiblePersonFilters('MVO')).toBe(false);
    expect(shouldLoadGlobalResponsiblePersons('OWNER')).toBe(true);
    expect(canUseGlobalResponsiblePersonFilters('OWNER')).toBe(true);
  });

  it('loads transfer targets and available-to-me only when the form needs them', () => {
    expect(formLoadPolicy('ASSIGNMENT')).toEqual({
      transferTargets: true,
      availableSources: true,
    });
    expect(formLoadPolicy('ISSUE')).toEqual({
      transferTargets: false,
      availableSources: true,
    });
  });

  it('keeps target and source errors inside the form instead of the list page', () => {
    const view = readFileSync(
      join(__dirname, 'stock-documents-view.tsx'),
      'utf8',
    );
    const controller = readFileSync(
      join(__dirname, 'use-stock-documents-controller.ts'),
      'utf8',
    );

    expect(view).not.toContain(
      '<ErrorState message={controller.targetsError}',
    );
    expect(view).not.toContain(
      '<ErrorState message={controller.personsError}',
    );
    expect(controller).not.toMatch(
      /useEffect\(\(\) => \{ void loadTargets\(\);/,
    );
    expect(controller).toContain(
      'if (policy.transferTargets) void loadTargets();',
    );
    expect(controller).toContain(
      'if (policy.availableSources) void loadSources(source);',
    );
    expect(controller).not.toMatch(/useEffect\(\(\) => \{ void loadSources\(/);
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
    expect(table).toContain("documentNumberLabel(document.documentNumber, true)");
    expect(details).toContain("user.role === 'MVO' ? [");
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
