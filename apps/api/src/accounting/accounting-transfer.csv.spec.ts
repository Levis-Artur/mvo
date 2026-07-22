import { accountingTransfersCsv } from './accounting-transfer.csv';

describe('accountingTransfersCsv', () => {
  const row = {
    documentNumber: '=CMD()',
    documentDate: new Date('2026-07-21T00:00:00.000Z'),
    sourcePersonnelNumber: '001',
    sourceFullName: 'Левіс Артур Сергійович',
    sourceManagementName: 'Управління "А"',
    destinationPersonnelNumber: '003',
    destinationFullName: 'Луцик Володимир',
    destinationManagementName: 'Управління Б',
    inventoryCode: 'KB;1',
    inventoryName: 'Клавіатура',
    unitOfMeasure: 'шт',
    quantity: '2.5000',
    documentStatus: 'POSTED',
  };

  it('creates UTF-8 BOM, semicolon-delimited CRLF CSV without mojibake', () => {
    const csv = accountingTransfersCsv([row]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Левіс Артур Сергійович');
    expect(csv).toContain('Клавіатура');
    expect(csv).toContain('"KB;1"');
    expect(csv.split('\n').every((line, index, lines) => index === lines.length - 1 || line.endsWith('\r'))).toBe(true);
  });

  it('escapes quotes and neutralizes spreadsheet formulas', () => {
    const csv = accountingTransfersCsv([row]);
    expect(csv).toContain('"\'=CMD()"');
    expect(csv).toContain('"Управління ""А"""');
  });
});
