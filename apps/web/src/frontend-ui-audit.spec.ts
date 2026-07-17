import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = join(__dirname);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : ['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.spec.ts')
        ? [path]
        : [];
  });
}

describe('frontend UI audit invariants', () => {
  const files = sourceFiles(root);

  it('не використовує browser dialogs або нативні кнопки поза Button', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
      if (!file.endsWith(join('components', 'ui', 'button.tsx'))) {
        expect(source).not.toContain('<button');
      }
    }
  });

  it('централізує HTML tables у DataTable', () => {
    const nativeTables = files.filter((file) =>
      readFileSync(file, 'utf8').includes('<table'),
    );
    expect(nativeTables.map((file) => relative(root, file))).toEqual([
      join('components', 'ui', 'data-table.tsx'),
    ]);
  });

  it('не містить limit понад 100 та типових mojibake-послідовностей', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\blimit\s*[:=]\s*(\d+)/g)) {
        expect(Number(match[1])).toBeLessThanOrEqual(100);
      }
      expect(source).not.toMatch(/(?:Р.|С.){2,}|вЂ|Ð.|Ñ.|Ã.|�/);
    }
  });

  it('зберігає responsive, overflow, focus і reduced-motion правила', () => {
    const tokens = readFileSync(join(root, 'styles', 'tokens.css'), 'utf8');
    const responsive = readFileSync(join(root, 'styles', 'responsive.css'), 'utf8');
    const globals = readFileSync(join(root, 'app', 'globals.css'), 'utf8');
    const components = readFileSync(join(root, 'styles', 'components.css'), 'utf8');

    for (const viewport of ['360px', '768px', '1024px', '1440px', '1920px']) {
      expect(tokens).toContain(viewport);
    }
    expect(responsive).toContain('@media (max-width: 899px)');
    expect(components).toContain('overflow: auto');
    expect(globals).toContain(':focus-visible');
    expect(globals).toContain('prefers-reduced-motion: reduce');
  });

  it('не містить hardcoded CSS colors поза tokens.css', () => {
    const cssFiles = [
      join(root, 'app', 'globals.css'),
      join(root, 'styles', 'components.css'),
      join(root, 'styles', 'layout.css'),
      join(root, 'styles', 'responsive.css'),
    ];
    for (const file of cssFiles) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });
});
