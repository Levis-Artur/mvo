import { inventoryItemHistoryCsv } from './inventory-item-history.csv';

describe('inventoryItemHistoryCsv', () => {
  it('creates a safe UTF-8 BOM, semicolon-delimited CRLF export', () => {
    const csv = inventoryItemHistoryCsv([
      {
        occurredAt: new Date('2026-07-22T10:15:00.000Z'),
        typeLabel: 'Прихід за CSV',
        from: 'Бухгалтерський CSV',
        to: '003 — Левіс Артур',
        quantity: '+5',
        balanceBefore: '0',
        balanceAfter: '5',
        documentNumber: '=IMPORT()',
        source: 'надходження.csv',
        user: '',
      },
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Прихід за CSV');
    expect(csv).toContain('Левіс Артур');
    expect(csv).toContain('"\'=IMPORT()"');
    expect(csv).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    expect(
      csv
        .split('\n')
        .every(
          (line, index, lines) =>
            index === lines.length - 1 || line.endsWith('\r'),
        ),
    ).toBe(true);
  });
});
