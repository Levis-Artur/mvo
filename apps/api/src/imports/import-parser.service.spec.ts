import * as iconv from 'iconv-lite';
import { ImportType } from '@prisma/client';
import { ImportParserService } from './import-parser.service';

function fixture(rows: string[]) {
  const headers = [
    'Кол.1',
    'Кол.2',
    'Кол.3',
    'Кол.4',
    'Контрагент',
    'Номенклатура',
    'Найменування',
    'Од.вим.',
    'Кол.9',
    'Кол.10',
    'Кол.11',
    'Кількість Дт',
    'Кол.13',
    'Кол.14',
    'Кол.15',
    'Кількість кін.',
  ].join('\t');

  return [headers, ...rows].join('\n');
}

describe('ImportParserService', () => {
  const parser = new ImportParserService();

  it('detects Windows-1251 encoded files', () => {
    const buffer = iconv.encode(
      fixture([
        '1\t2\t3\t4\tТестовий О.Д._0619\t0001\tКартка\tшт\t9\t10\t11\t5\t13\t14\t15\t15',
      ]),
      'win1251',
    );

    const result = parser.parse(buffer, ImportType.RECEIPT, 1024 * 1024);

    expect(result.encoding).toBe('windows-1251');
    expect(result.rows[0].counterpartyRaw).toBe('Тестовий О.Д._0619');
  });

  it('detects tab delimiter', () => {
    const result = parser.parse(
      Buffer.from(
        fixture([
          '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t1\t13\t14\t15\t2',
        ]),
      ),
      ImportType.RECEIPT,
      1024 * 1024,
    );

    expect(result.delimiter).toBe('\t');
  });

  it('normalizes headers', () => {
    expect(parser.normalizeHeader('\uFEFF  Кількість   Дт \t')).toBe(
      'кількість дт',
    );
  });

  it('finds columns by normalized names', () => {
    const result = parser.parse(
      Buffer.from(
        fixture([
          '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t7\t13\t14\t15\t8',
        ]),
      ),
      ImportType.RECEIPT,
      1024 * 1024,
    );

    expect(result.rows[0].parsedQuantity).toBe('7');
  });

  it('uses fallback column positions', () => {
    const headers = Array.from(
      { length: 16 },
      (_, index) => `X${index + 1}`,
    ).join('\t');
    const row =
      '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t9\t13\t14\t15\t20';
    const result = parser.parse(
      Buffer.from(`${headers}\n${row}`),
      ImportType.INITIAL_BALANCE,
      1024 * 1024,
    );

    expect(result.rows[0].parsedQuantity).toBe('20');
  });

  it('parses decimal comma', () => {
    expect(parser.parseQuantity('100,5')).toBe('100.5');
  });

  it('parses spaced decimal values', () => {
    expect(parser.parseQuantity('1 000,50')).toBe('1000.50');
  });

  it('INITIAL_BALANCE uses ending quantity', () => {
    const result = parser.parse(
      Buffer.from(
        fixture([
          '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t5\t13\t14\t15\t25',
        ]),
      ),
      ImportType.INITIAL_BALANCE,
      1024 * 1024,
    );

    expect(result.rows[0].parsedQuantity).toBe('25');
  });

  it('RECEIPT uses debit quantity', () => {
    const result = parser.parse(
      Buffer.from(
        fixture([
          '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t6\t13\t14\t15\t25',
        ]),
      ),
      ImportType.RECEIPT,
      1024 * 1024,
    );

    expect(result.rows[0].parsedQuantity).toBe('6');
  });

  it('RECEIPT skips zero quantities', () => {
    const result = parser.parse(
      Buffer.from(
        fixture([
          '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t0\t13\t14\t15\t25',
        ]),
      ),
      ImportType.RECEIPT,
      1024 * 1024,
    );

    expect(result.rows[0].status).toBe('SKIPPED');
  });

  it('INITIAL_BALANCE skips zero quantities', () => {
    const result = parser.parse(
      Buffer.from(
        fixture([
          '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t4\t13\t14\t15\t0',
        ]),
      ),
      ImportType.INITIAL_BALANCE,
      1024 * 1024,
    );

    expect(result.rows[0].status).toBe('SKIPPED');
  });

  it('marks negative quantity as ERROR', () => {
    const result = parser.parse(
      Buffer.from(
        fixture([
          '1\t2\t3\t4\tМВО\t0001\tПозиція\tшт\t9\t10\t11\t-1\t13\t14\t15\t25',
        ]),
      ),
      ImportType.RECEIPT,
      1024 * 1024,
    );

    expect(result.rows[0].status).toBe('ERROR');
  });
});
