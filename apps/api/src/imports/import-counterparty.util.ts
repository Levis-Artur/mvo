import type { ParsedImportRow } from './import-parser.service';

export type ParsedAccountingCounterparty = {
  externalAccountingName?: string;
  externalAccountingCode?: string;
  error?: string;
};

export function parseAccountingCounterparty(
  rawValue: string,
): ParsedAccountingCounterparty {
  const value = rawValue.trim();
  const separatorIndex = value.lastIndexOf('_');

  if (separatorIndex < 0) {
    return {
      error: 'Не вдалося визначити код МВО з колонки "Контрагент".',
    };
  }

  const externalAccountingName = value.slice(0, separatorIndex).trim();
  const externalAccountingCode = value.slice(separatorIndex + 1).trim();

  if (!externalAccountingCode) {
    return {
      externalAccountingName,
      error: 'У колонці "Контрагент" відсутній код МВО.',
    };
  }

  if (!/^\d{4}$/.test(externalAccountingCode)) {
    return {
      externalAccountingName,
      externalAccountingCode,
      error: `Некоректний код МВО: "${externalAccountingCode}". Очікується 4 цифри.`,
    };
  }

  return { externalAccountingName, externalAccountingCode };
}

export function markCounterpartyCodeCollisions(
  rows: ParsedImportRow[],
): ParsedImportRow[] {
  const namesByCode = new Map<string, Map<string, string>>();

  for (const row of rows) {
    if (!row.externalAccountingCode || !row.externalAccountingName) continue;
    const displayName = row.externalAccountingName.trim().replace(/\s+/g, ' ');
    const normalizedName = displayName.toLocaleLowerCase('uk-UA');
    const names = namesByCode.get(row.externalAccountingCode) ?? new Map();
    if (!names.has(normalizedName)) names.set(normalizedName, displayName);
    namesByCode.set(row.externalAccountingCode, names);
  }

  const collisionMessages = new Map<string, string>();
  for (const [code, names] of namesByCode) {
    if (names.size > 1) {
      collisionMessages.set(
        code,
        `Код МВО ${code} використано у файлі для кількох контрагентів: ${[
          ...names.values(),
        ].join('; ')}.`,
      );
    }
  }

  if (!collisionMessages.size) return rows;

  return rows.map((row) => {
    const collision = row.externalAccountingCode
      ? collisionMessages.get(row.externalAccountingCode)
      : undefined;
    if (!collision) return row;
    return {
      ...row,
      status: 'ERROR',
      message: [row.message, collision].filter(Boolean).join('; '),
    };
  });
}
