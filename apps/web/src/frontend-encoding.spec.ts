import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('frontend source encoding', () => {
  const srcRoot = join(__dirname);

  it('keeps key Ukrainian headings readable', () => {
    const dashboard = readFileSync(
      join(srcRoot, 'features/dashboard/dashboard-view.tsx'),
      'utf8',
    );
    const users = readFileSync(
      join(srcRoot, 'features/users/users-view.tsx'),
      'utf8',
    );
    const organization = readFileSync(
      join(srcRoot, 'features/organization/organization-view.tsx'),
      'utf8',
    );

    expect(dashboard).toContain('title="Головна"');
    expect(users).toContain("'Користувачі'");
    expect(organization).toContain('title="Організаційна структура"');
  });

  it('does not contain common UTF-8 mojibake sequences', () => {
    const files = [
      'components/common/tables.tsx',
      'features/dashboard/dashboard-view.tsx',
      'features/imports/import-upload-modal.tsx',
      'features/inventory/transactions-view.tsx',
      'features/organization/organization-view.tsx',
      'features/responsible-persons/person-stock-tabs.tsx',
    ];

    for (const file of files) {
      const source = readFileSync(join(srcRoot, file), 'utf8');
      expect(source).not.toMatch(/(?:Р.|С.){2,}|вЂ/);
    }
  });
});
