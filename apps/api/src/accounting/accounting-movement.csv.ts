export type AccountingMovementCsvRow = {
  occurredAt: string;
  documentLabel: string;
  operationLabel: string;
  mvoCode: string;
  mvoName: string;
  inventoryCode: string;
  inventoryName: string;
  quantity: string;
  direction: string;
  statusLabel: string;
};

const HEADERS = [
  'Дата',
  'Документ',
  'Операція',
  'Код МВО',
  'МВО',
  'Код номенклатури',
  'Назва',
  'Кількість',
  'Напрямок / Одержувач',
  'Статус',
] as const;

export function buildAccountingMovementCsv(
  rows: readonly AccountingMovementCsvRow[],
) {
  return `\uFEFF${csvLine(HEADERS)}${rows
    .map((row) =>
      csvLine([
        formatDateTime(row.occurredAt),
        row.documentLabel,
        row.operationLabel,
        row.mvoCode,
        row.mvoName,
        row.inventoryCode,
        row.inventoryName,
        row.quantity,
        row.direction,
        row.statusLabel,
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

function formatDateTime(value: string) {
  return new Date(value).toISOString().replace('T', ' ').slice(0, 19);
}
