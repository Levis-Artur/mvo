const HEADERS = [
  'Номер документа',
  'Дата',
  'Номер MVO-відправника',
  'ПІБ MVO-відправника',
  'Управління відправника',
  'Номер MVO-одержувача',
  'ПІБ MVO-одержувача',
  'Управління одержувача',
  'Код номенклатури',
  'Назва',
  'Одиниця виміру',
  'Кількість',
  'Статус',
] as const;

type AccountingTransferCsvRowBase = {
  documentDate: Date;
  sourcePersonnelNumber: string;
  sourceFullName: string;
  sourceManagementName: string;
  destinationPersonnelNumber: string;
  destinationFullName: string;
  destinationManagementName: string;
  inventoryCode: string;
  inventoryName: string;
  unitOfMeasure: string | null;
  quantity: { toString(): string } | string;
  documentStatus: string;
};

export type AccountingTransferCsvV1Row = AccountingTransferCsvRowBase & {
  documentNumber: string;
};

export type AccountingTransferCsvV2Row = AccountingTransferCsvRowBase & {
  displayNumber: number;
};

export const ACCOUNTING_TRANSFER_EXPORT_FORMAT_V1 = 1;
export const ACCOUNTING_TRANSFER_EXPORT_FORMAT_V2 = 2;

export function buildAccountingTransferCsvV1(
  rows: readonly AccountingTransferCsvV1Row[],
) {
  return buildAccountingTransferCsv(rows, (row) => row.documentNumber);
}

export function buildAccountingTransferCsvV2(
  rows: readonly AccountingTransferCsvV2Row[],
) {
  return buildAccountingTransferCsv(rows, (row) => `№ ${row.displayNumber}`);
}

function buildAccountingTransferCsv<Row extends AccountingTransferCsvRowBase>(
  rows: readonly Row[],
  documentNumber: (row: Row) => string,
) {
  return `\uFEFF${csvLine(HEADERS)}${rows.map((row) => csvLine([
    documentNumber(row),
    formatDate(row.documentDate),
    row.sourcePersonnelNumber,
    row.sourceFullName,
    row.sourceManagementName,
    row.destinationPersonnelNumber,
    row.destinationFullName,
    row.destinationManagementName,
    row.inventoryCode,
    row.inventoryName,
    row.unitOfMeasure ?? '',
    row.quantity.toString(),
    statusLabel(row.documentStatus),
  ])).join('')}`;
}

function csvLine(values: readonly unknown[]) {
  return `${values.map(csvCell).join(';')}\r\n`;
}

function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function statusLabel(status: string) {
  if (status === 'POSTED') return 'Проведено';
  if (status === 'CANCELLED') return 'Скасовано';
  return 'Чернетка';
}
