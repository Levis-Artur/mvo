import { createHash } from 'node:crypto';
import {
  buildAccountingTransferCsvV1,
  buildAccountingTransferCsvV2,
} from './accounting-transfer.csv';

describe('accounting transfer CSV formats', () => {
  const baseRow = {
    documentDate: new Date('2026-07-21T00:00:00.000Z'),
    sourceAccountingCode: '0057',
    sourceFullName: 'Левіс Артур Сергійович',
    sourceManagementName: 'Управління "А"',
    destinationAccountingCode: '0061',
    destinationFullName: 'Луцик Володимир',
    destinationManagementName: 'Управління Б',
    inventoryCode: 'KB;1',
    inventoryName: 'Клавіатура',
    unitOfMeasure: 'шт',
    quantity: '2.5000',
    documentStatus: 'POSTED',
  };

  const expectedV1 = [
    '\uFEFF"Номер документа";"Дата";"Код МВО-відправника";"ПІБ MVO-відправника";"Управління відправника";"Код МВО-одержувача";"ПІБ MVO-одержувача";"Управління одержувача";"Код номенклатури";"Назва";"Одиниця виміру";"Кількість";"Статус"',
    '"MVO-INTERNAL-UUID-LIKE";"2026-07-21";"0057";"Левіс Артур Сергійович";"Управління ""А""";"0061";"Луцик Володимир";"Управління Б";"KB;1";"Клавіатура";"шт";"2.5000";"Проведено"',
    '',
  ].join('\r\n');

  it('keeps the V1 document number while exporting accounting codes', () => {
    const csv = buildAccountingTransferCsvV1([
      { ...baseRow, documentNumber: 'MVO-INTERNAL-UUID-LIKE' },
    ]);

    expect(csv).toBe(expectedV1);
    expect(createHash('sha256').update(csv, 'utf8').digest('hex')).toBe(
      '85afc514611152eca5798010f2486a7b5e9d99faac529c9d7b2325e10789c84e',
    );
  });

  it('creates V2 with only the human display number', () => {
    const csv = buildAccountingTransferCsvV2([
      { ...baseRow, displayNumber: 7 },
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"№ 7";');
    expect(csv).not.toContain('MVO-INTERNAL');
    expect(csv).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
    expect(csv.split('\n').every((line, index, lines) =>
      index === lines.length - 1 || line.endsWith('\r'),
    )).toBe(true);
  });

  it('escapes quotes and neutralizes spreadsheet formulas in both formats', () => {
    const v1 = buildAccountingTransferCsvV1([
      {
        ...baseRow,
        documentNumber: '=CMD()',
        inventoryName: '=CMD()',
      },
    ]);
    const v2 = buildAccountingTransferCsvV2([
      { ...baseRow, displayNumber: 7, inventoryName: '=CMD()' },
    ]);

    expect(v1).toContain('"\'=CMD()";');
    expect(v1).toContain('"Управління ""А"""');
    expect(v2).toContain('"\'=CMD()"');
  });
});
