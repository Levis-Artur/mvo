export const MY_PROPERTY_CSV_HEADERS = [
  'Категорія',
  'Код',
  'Назва',
  'Одиниця виміру',
  'Тип джерела',
  'Номер облікового власника',
  'Обліковий власник',
  'Управління облікового власника',
  'Служба облікового власника',
  'Підрозділ облікового власника',
  'Номер фактичного утримувача',
  'Фактичний утримувач',
  'Управління фактичного утримувача',
  'Служба фактичного утримувача',
  'Підрозділ фактичного утримувача',
  'Кількість',
  'Доступно для передачі',
  'Доступно для видачі',
  'Дата останнього оновлення',
] as const;

const FORMULA_PREFIX = /^[=+\-@]/;
const EXCEL_NUMERIC_CODE = /^(?:0\d+|\d{11,})$/;

export function protectCsvValue(value: unknown, preserveNumericCode = false) {
  const text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_PREFIX.test(text) || (preserveNumericCode && EXCEL_NUMERIC_CODE.test(text))) {
    return `'${text}`;
  }
  return text;
}

export function escapeCsvValue(value: unknown, preserveNumericCode = false) {
  const safe = protectCsvValue(value, preserveNumericCode).replaceAll('"', '""');
  return `"${safe}"`;
}

export function csvRow(values: readonly unknown[], numericCodeColumns: number[] = []) {
  const preserved = new Set(numericCodeColumns);
  return `${values.map((value, index) => escapeCsvValue(value, preserved.has(index))).join(';')}\r\n`;
}

export function csvPreamble() {
  return `\uFEFF${csvRow(MY_PROPERTY_CSV_HEADERS)}`;
}
