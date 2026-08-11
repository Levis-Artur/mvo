const HEADERS = [
  '№ видачі',
  'Дата видачі',
  'Код МВО',
  'МВО',
  'Кому видано',
  'Код номенклатури',
  'Номенклатура',
  'Одиниця',
  'Видано',
  'Реалізовано всього',
  'Залишилось нереалізовано',
  '№ реалізації',
  'Дата реалізації',
  'Одержувач / примітка',
  'Кількість реалізації',
  'Коментар реалізації',
  'Статус реалізації',
  'Документ реалізації',
  'Назва файла документа реалізації',
  'Автор реалізації',
  'Дата створення реалізації',
  'Коментар видачі',
  'Статус видачі',
  'Документ видачі',
  'Назва файла документа видачі',
  'Автор видачі',
  'Дата створення видачі',
] as const;

type IssueCsvRealization = {
  displayNumber: number;
  realizationDate: Date;
  recipientText: string | null;
  quantity: { toString(): string } | string;
  note: string | null;
  status: string;
  attachmentNames: string[];
  author: string;
  createdAt: Date;
};

export type IssueCsvRow = {
  displayNumber: number;
  documentDate: Date;
  mvoCode: string;
  mvoName: string;
  inventoryCode: string;
  inventoryName: string;
  unit: string | null;
  issuedQuantity: { toString(): string } | string;
  realizedQuantity: { toString(): string } | string;
  availableToRealize: { toString(): string } | string;
  recipientName: string;
  note: string | null;
  status: string;
  attachmentNames: string[];
  author: string;
  createdAt: Date;
  realization: IssueCsvRealization | null;
};

export function buildIssueHistoryCsv(rows: readonly IssueCsvRow[]) {
  return `\uFEFF${csvLine(HEADERS)}${rows
    .map((row) =>
      csvLine([
        `№ ${row.displayNumber}`,
        formatDate(row.documentDate),
        row.mvoCode,
        row.mvoName,
        row.recipientName,
        row.inventoryCode,
        row.inventoryName,
        row.unit ?? '',
        row.issuedQuantity.toString(),
        row.realizedQuantity.toString(),
        row.availableToRealize.toString(),
        row.realization ? `№ ${row.realization.displayNumber}` : '',
        row.realization ? formatDate(row.realization.realizationDate) : '',
        row.realization?.recipientText ?? '',
        row.realization?.quantity.toString() ?? '0',
        row.realization?.note ?? '',
        row.realization ? statusLabel(row.realization.status) : '',
        attachmentLabel(row.realization?.attachmentNames ?? []),
        row.realization?.attachmentNames.join(', ') ?? '',
        row.realization?.author ?? '',
        row.realization?.createdAt.toISOString() ?? '',
        row.note ?? '',
        statusLabel(row.status),
        attachmentLabel(row.attachmentNames),
        row.attachmentNames.join(', '),
        row.author,
        row.createdAt.toISOString(),
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

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function attachmentLabel(attachmentNames: readonly string[]) {
  return attachmentNames.length ? 'Є документ' : 'Немає';
}

function statusLabel(status: string) {
  if (status === 'POSTED') return 'Проведено';
  if (status === 'CANCELLED') return 'Скасовано';
  return 'Чернетка';
}
