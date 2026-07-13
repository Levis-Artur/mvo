import { BadRequestException, Injectable } from '@nestjs/common';
import { ImportType } from '@prisma/client';
import { createHash } from 'node:crypto';
import * as iconv from 'iconv-lite';

export type ParsedImportRow = {
  rowNumber: number;
  counterpartyRaw: string;
  nomenclatureCodeRaw: string;
  itemNameRaw: string;
  unitOfMeasureRaw?: string;
  debitQuantityRaw?: string;
  endingQuantityRaw?: string;
  parsedQuantity?: string;
  status: 'VALID' | 'WARNING' | 'ERROR' | 'SKIPPED';
  message?: string;
};

export type ParsedImportFile = {
  fileHash: string;
  encoding: 'utf-8' | 'utf-8-bom' | 'windows-1251';
  delimiter: '\t' | ';' | ',';
  totalRows: number;
  rows: ParsedImportRow[];
};

type ColumnMap = {
  counterparty: number;
  nomenclatureCode: number;
  itemName: number;
  debitQuantity: number;
  endingQuantity: number;
  unitOfMeasure?: number;
};

const namedColumns = {
  counterparty: ['контрагент'],
  nomenclatureCode: ['номенклатура'],
  itemName: ['найменування'],
  debitQuantity: ['кількість дт', 'кiлькiсть дт'],
  endingQuantity: ['кількість кін.', 'кількість кін', 'кiлькiсть кiн.'],
  unitOfMeasure: ['од.вим.', 'од. вим.', 'од вим', 'одиниця виміру'],
};

const fallbackColumns = {
  counterparty: 4,
  nomenclatureCode: 5,
  itemName: 6,
  debitQuantity: 11,
  endingQuantity: 15,
};

@Injectable()
export class ImportParserService {
  parse(
    buffer: Buffer,
    importType: ImportType,
    maxFileSizeBytes: number,
  ): ParsedImportFile {
    if (buffer.byteLength > maxFileSizeBytes) {
      throw new BadRequestException('Файл перевищує дозволений розмір');
    }

    this.rejectBinary(buffer);

    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const { text, encoding } = this.decode(buffer);
    const delimiter = this.detectDelimiter(text);
    const records = this.parseDelimited(text, delimiter);

    if (records.length < 2) {
      throw new BadRequestException('Файл не містить рядків даних');
    }

    const columns = this.resolveColumns(records[0]);
    const seen = new Set<string>();
    const rows = records.slice(1).map((record, index) => {
      const rowNumber = index + 2;
      const row = this.toImportRow(
        record,
        rowNumber,
        columns,
        importType,
        seen,
      );
      return row;
    });

    return {
      fileHash,
      encoding,
      delimiter,
      totalRows: rows.length,
      rows,
    };
  }

  normalizeHeader(value: string): string {
    return value
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('uk-UA');
  }

  parseQuantity(raw: string | undefined): string | undefined {
    const value = raw?.trim();

    if (!value) {
      return undefined;
    }

    const normalized = value.replace(/\s/g, '').replace(',', '.');

    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      throw new Error('Некоректне числове значення');
    }

    return normalized;
  }

  private decode(buffer: Buffer): {
    text: string;
    encoding: ParsedImportFile['encoding'];
  } {
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return {
        text: buffer.toString('utf8').replace(/^\uFEFF/, ''),
        encoding: 'utf-8-bom',
      };
    }

    const utf8 = buffer.toString('utf8');
    if (!utf8.includes('\uFFFD')) {
      return { text: utf8, encoding: 'utf-8' };
    }

    return {
      text: iconv.decode(buffer, 'win1251'),
      encoding: 'windows-1251',
    };
  }

  private detectDelimiter(text: string): ParsedImportFile['delimiter'] {
    const firstLine = text
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0);

    if (!firstLine) {
      throw new BadRequestException('Файл порожній');
    }

    const candidates: ParsedImportFile['delimiter'][] = ['\t', ';', ','];
    return candidates
      .map((delimiter) => ({
        delimiter,
        count: this.parseDelimitedLine(firstLine, delimiter).length,
      }))
      .sort((a, b) => b.count - a.count)[0].delimiter;
  }

  private parseDelimited(
    text: string,
    delimiter: ParsedImportFile['delimiter'],
  ): string[][] {
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => this.parseDelimitedLine(line, delimiter));
  }

  private parseDelimitedLine(
    line: string,
    delimiter: ParsedImportFile['delimiter'],
  ): string[] {
    const cells: string[] = [];
    let current = '';
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    cells.push(current.trim());
    return cells;
  }

  private resolveColumns(headers: string[]): ColumnMap {
    const normalized = headers.map((header) => this.normalizeHeader(header));
    const find = (aliases: string[], fallback: number) => {
      const index = normalized.findIndex((header) =>
        aliases.includes(this.normalizeHeader(header)),
      );

      return index >= 0 ? index : fallback;
    };

    return {
      counterparty: find(
        namedColumns.counterparty,
        fallbackColumns.counterparty,
      ),
      nomenclatureCode: find(
        namedColumns.nomenclatureCode,
        fallbackColumns.nomenclatureCode,
      ),
      itemName: find(namedColumns.itemName, fallbackColumns.itemName),
      debitQuantity: find(
        namedColumns.debitQuantity,
        fallbackColumns.debitQuantity,
      ),
      endingQuantity: find(
        namedColumns.endingQuantity,
        fallbackColumns.endingQuantity,
      ),
      unitOfMeasure: normalized.findIndex((header) =>
        namedColumns.unitOfMeasure.includes(header),
      ),
    };
  }

  private toImportRow(
    record: string[],
    rowNumber: number,
    columns: ColumnMap,
    importType: ImportType,
    seen: Set<string>,
  ): ParsedImportRow {
    const counterpartyRaw = this.clean(record[columns.counterparty]);
    const nomenclatureCodeRaw = this.clean(record[columns.nomenclatureCode]);
    const itemNameRaw = this.clean(record[columns.itemName]);
    const debitQuantityRaw = this.clean(record[columns.debitQuantity]);
    const endingQuantityRaw = this.clean(record[columns.endingQuantity]);
    const unitOfMeasureRaw =
      columns.unitOfMeasure !== undefined && columns.unitOfMeasure >= 0
        ? this.clean(record[columns.unitOfMeasure])
        : undefined;
    const quantityRaw =
      importType === ImportType.INITIAL_BALANCE
        ? endingQuantityRaw
        : debitQuantityRaw;
    const key = [counterpartyRaw, nomenclatureCodeRaw, quantityRaw].join('|');
    const messages: string[] = [];

    if (!counterpartyRaw) messages.push('Не заповнено контрагента');
    if (!nomenclatureCodeRaw) messages.push('Не заповнено код номенклатури');
    if (!itemNameRaw) messages.push('Не заповнено найменування');
    if (seen.has(key)) messages.push('Повтор рядка у файлі');
    seen.add(key);

    let parsedQuantity: string | undefined;
    try {
      parsedQuantity = this.parseQuantity(quantityRaw);
    } catch {
      messages.push('Некоректна кількість');
    }

    if (importType === ImportType.INITIAL_BALANCE && !parsedQuantity) {
      messages.push('Початковий залишок не може мати порожню кількість');
    }

    if (parsedQuantity?.startsWith('-')) {
      messages.push('Кількість не може бути від’ємною');
    }

    if (messages.length > 0) {
      return {
        rowNumber,
        counterpartyRaw,
        nomenclatureCodeRaw,
        itemNameRaw,
        unitOfMeasureRaw,
        debitQuantityRaw,
        endingQuantityRaw,
        parsedQuantity,
        status: 'ERROR',
        message: messages.join('; '),
      };
    }

    if (
      (importType === ImportType.RECEIPT ||
        importType === ImportType.INITIAL_BALANCE) &&
      parsedQuantity &&
      new DecimalLike(parsedQuantity).isZero()
    ) {
      return {
        rowNumber,
        counterpartyRaw,
        nomenclatureCodeRaw,
        itemNameRaw,
        unitOfMeasureRaw,
        debitQuantityRaw,
        endingQuantityRaw,
        status: 'SKIPPED',
        message:
          importType === ImportType.RECEIPT
            ? 'Рядок пропущено: немає нового надходження'
            : 'Рядок із нульовою кількістю пропущено',
      };
    }

    if (importType === ImportType.RECEIPT && !parsedQuantity) {
      return {
        rowNumber,
        counterpartyRaw,
        nomenclatureCodeRaw,
        itemNameRaw,
        unitOfMeasureRaw,
        debitQuantityRaw,
        endingQuantityRaw,
        status: 'SKIPPED',
        message: 'Рядок пропущено: немає нового надходження',
      };
    }

    return {
      rowNumber,
      counterpartyRaw,
      nomenclatureCodeRaw,
      itemNameRaw,
      unitOfMeasureRaw,
      debitQuantityRaw,
      endingQuantityRaw,
      parsedQuantity,
      status: 'VALID',
    };
  }

  private rejectBinary(buffer: Buffer): void {
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
    if (sample.includes(0)) {
      throw new BadRequestException(
        'Файл схожий на бінарний і не підтримується',
      );
    }
  }

  private clean(value: string | undefined): string {
    return (value ?? '')
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/\s+/g, ' ');
  }
}

class DecimalLike {
  constructor(private readonly value: string) {}

  isZero(): boolean {
    return /^0+(\.0+)?$/.test(this.value);
  }
}
