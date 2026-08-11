const HEADERS = [
  '№ видачі',
  'Дата видачі',
  'Код МВО',
  'МВО',
  'Код номенклатури',
  'Номенклатура',
  'Одиниця',
  'Видано',
  'Реалізовано',
  'Залишилося реалізувати',
  'Кому видано',
  'Коментар',
  'Статус',
  'Є підтверджуючий документ',
  'Назва файла документа',
  'Автор',
  'Дата створення',
] as const;

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
};

export function buildIssueHistoryCsv(rows: readonly IssueCsvRow[]) {
  return `\uFEFF${csvLine(HEADERS)}${rows
    .map((row) =>
      csvLine([
        `№ ${row.displayNumber}`,
        formatDate(row.documentDate),
        row.mvoCode,
        row.mvoName,
        row.inventoryCode,
        row.inventoryName,
        row.unit ?? '',
        row.issuedQuantity.toString(),
        row.realizedQuantity.toString(),
        row.availableToRealize.toString(),
        row.recipientName,
        row.note ?? '',
        statusLabel(row.status),
        row.attachmentNames.length ? 'Так' : 'Ні',
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

function statusLabel(status: string) {
  if (status === 'POSTED') return 'Проведено';
  if (status === 'CANCELLED') return 'Скасовано';
  return 'Чернетка';
}
