export type AccountingMovementCsvRow = {
  occurredAt: string;
  documentLabel: string;
  operationLabel: string;
  mvoCode: string;
  mvoName: string;
  transferredToCode: string;
  transferredToName: string;
  inventoryCode: string;
  inventoryName: string;
  unitOfMeasure: string;
  quantity: string;
  issuedTo: string;
  relatedTransfer: string;
  statusLabel: string;
  hasAttachment: string;
};

const HEADERS = [
  'Дата',
  'Тип операції',
  'Документ',
  'Код МВО',
  'МВО',
  'Кому передано — код МВО',
  'Кому передано — ПІБ',
  'Код номенклатури',
  'Номенклатура',
  'Одиниця',
  'Кількість',
  'Кому видано',
  'Пов’язана передача',
  'Статус',
  'Є підтверджуючий документ',
] as const;

export function buildAccountingMovementCsv(
  rows: readonly AccountingMovementCsvRow[],
) {
  return `\uFEFF${csvLine(HEADERS)}${rows
    .map((row) =>
      csvLine([
        formatDateTime(row.occurredAt),
        row.operationLabel,
        row.documentLabel,
        row.mvoCode,
        row.mvoName,
        row.transferredToCode,
        row.transferredToName,
        row.inventoryCode,
        row.inventoryName,
        row.unitOfMeasure,
        row.quantity,
        row.issuedTo,
        row.relatedTransfer,
        row.statusLabel,
        row.hasAttachment,
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
