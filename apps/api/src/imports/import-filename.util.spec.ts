import { normalizeImportFilename } from './import-filename.util';

describe('normalizeImportFilename', () => {
  it('repairs a UTF-8 Ukrainian filename interpreted as latin1', () => {
    const expected = 'Залишки майна.csv';
    const mojibake = Buffer.from(expected, 'utf8').toString('latin1');

    expect(normalizeImportFilename(mojibake)).toBe(expected);
  });

  it('keeps an ASCII filename unchanged', () => {
    expect(normalizeImportFilename('inventory-2026.csv')).toBe(
      'inventory-2026.csv',
    );
  });

  it('keeps an already correct Unicode filename unchanged', () => {
    expect(normalizeImportFilename('Надходження липень.csv')).toBe(
      'Надходження липень.csv',
    );
  });

  it('removes path components and control characters', () => {
    expect(normalizeImportFilename('../private/небезпечний\u0000.csv')).toBe(
      'небезпечний.csv',
    );
    expect(normalizeImportFilename('..\\private\\report.csv')).toBe(
      'report.csv',
    );
  });

  it('limits length while preserving the extension', () => {
    const result = normalizeImportFilename(`${'д'.repeat(300)}.csv`);

    expect(result).toHaveLength(255);
    expect(result.endsWith('.csv')).toBe(true);
  });
});
