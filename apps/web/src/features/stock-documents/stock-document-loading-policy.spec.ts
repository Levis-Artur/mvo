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
  });
});
