export type InventoryMovementCsvRow = {
  occurredAt: Date;
  typeLabel: string;
  from: string;
  to: string;
  quantity: string;
  balanceBefore: string;
  balanceAfter: string;
  documentNumber: string;
  source: string;
  user: string;
};

const HEADERS = [
  'Дата і час',
  'Тип операції',
  'Звідки',
  'Куди або кому',
  'Кількість',
  'Було',
  'Стало',
  'Номер документа',
  'Джерело',
  'Користувач',
] as const;

export function inventoryItemHistoryCsv(
  rows: readonly InventoryMovementCsvRow[],
) {
  return `\uFEFF${csvLine(HEADERS)}${rows
    .map((row) =>
      csvLine([
        row.occurredAt.toISOString(),
        row.typeLabel,
        row.from,
        row.to,
        row.quantity,
        row.balanceBefore,
        row.balanceAfter,
        row.documentNumber,
        row.source,
        row.user,
      ]),
    )
    .join('')}`;
}

function csvLine(values: readonly unknown[]) {
  return `${values.map(csvCell).join(';')}\r\n`;
}

function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
