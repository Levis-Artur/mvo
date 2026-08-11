import type { AvailableStockSource, StockDocumentType } from '@/lib/types';
import type { DocumentFormLine } from './stock-document.types';

export function stockSourceKey(
  source: Pick<AvailableStockSource, 'balanceId'>,
) {
  return source.balanceId;
}

export function documentLineSourceKey(
  line: Pick<DocumentFormLine, 'sourceBalanceId'>,
) {
  return line.sourceBalanceId;
}

export function findStockSourceForLine(
  sources: AvailableStockSource[],
  line: DocumentFormLine,
) {
  return (
    sources.find(
      (source) => stockSourceKey(source) === documentLineSourceKey(line),
    ) ??
    sources.find(
      (source) =>
        source.inventoryItem.id === line.inventoryItemId &&
        source.balanceId === line.sourceBalanceId,
    )
  );
}

export function availableSourceOptions(
  sources: AvailableStockSource[],
  selectedSourceKeys: string[],
  type?: StockDocumentType,
) {
  const selected = new Set(selectedSourceKeys);
  return sources.filter(
    (source) =>
      !('sourceKind' in source) &&
      Boolean(source.balanceId) &&
      (type === 'MVO_TRANSFER' ? source.canTransfer : source.canIssue) &&
      Number(source.availableQuantity) > 0 &&
      !selected.has(stockSourceKey(source)),
  );
}

export function filterStockSources(
  sources: AvailableStockSource[],
  selectedSourceKeys: string[],
  search: string,
  type?: StockDocumentType,
) {
  const needle = search.trim().toLocaleLowerCase('uk-UA');
  return availableSourceOptions(sources, selectedSourceKeys, type)
    .filter((source) => !needle || stockSourceSearchText(source).includes(needle))
    .sort(
      (left, right) =>
        left.inventoryItem.externalCode.localeCompare(
          right.inventoryItem.externalCode,
          'uk-UA',
          { numeric: true },
        ) ||
        left.inventoryItem.name.localeCompare(
          right.inventoryItem.name,
          'uk-UA',
        ),
    );
}

export function stockSourceSearchText(source: AvailableStockSource) {
  return [source.inventoryItem.externalCode, source.inventoryItem.name]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('uk-UA');
}

export function canOpenSourcePicker(sourceReady: boolean) {
  return sourceReady;
}

export function sourceToDocumentLine(
  source: AvailableStockSource,
): DocumentFormLine {
  return {
    inventoryItemId: source.inventoryItem.id,
    sourceBalanceId: source.balanceId,
    quantity: '',
    note: '',
  };
}

export function addSelectedStockSource(
  lines: DocumentFormLine[],
  source: AvailableStockSource,
) {
  const key = stockSourceKey(source);
  if (lines.some((line) => documentLineSourceKey(line) === key)) return lines;
  return [...lines, sourceToDocumentLine(source)];
}

export function removeDocumentLine(
  lines: DocumentFormLine[],
  index: number,
) {
  return lines.filter((_, currentIndex) => currentIndex !== index);
}
