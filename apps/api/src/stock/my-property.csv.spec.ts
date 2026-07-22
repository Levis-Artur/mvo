import {
  csvPreamble,
  csvRow,
  escapeCsvValue,
  MY_PROPERTY_CSV_HEADERS,
} from './my-property.csv';

describe('my-property CSV format', () => {
  it('uses UTF-8 BOM, Ukrainian headers, semicolons and CRLF', () => {
    const csv = csvPreamble();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Категорія";"Код";"Назва"');
    expect(csv).toContain('"Статус документа"');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(MY_PROPERTY_CSV_HEADERS).toHaveLength(9);
  });

  it('escapes quotes and neutralizes formula injection', () => {
    expect(escapeCsvValue('Назва "майна"')).toBe('"Назва ""майна"""');
    expect(escapeCsvValue('=HYPERLINK("https://example.test")'))
      .toBe('"\'=HYPERLINK(""https://example.test"")"');
    expect(escapeCsvValue('+1')).toBe('"\'+1"');
    expect(escapeCsvValue('-1')).toBe('"\'-1"');
    expect(escapeCsvValue('@SUM')).toBe('"\'@SUM"');
  });

  it('preserves numeric codes without changing decimal quantities', () => {
    const row = csvRow(['002', '123456789012345', '3.5000'], [0, 1]);
    expect(row).toBe('"\'002";"\'123456789012345";"3.5000"\r\n');
  });
});
