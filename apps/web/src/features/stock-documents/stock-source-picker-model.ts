import type { AvailableStockSource, StockDocumentType } from '@/lib/types';
import type { DocumentFormLine } from './stock-document.types';

export type StockSourceFilter = 'ALL' | AvailableStockSource['sourceKind'];

export function stockSourceKey(
  source: Pick<AvailableStockSource, 'sourceKind' | 'sourceBalanceId'>,
) {
  return `${source.sourceKind}:${source.sourceBalanceId}`;
}

export function documentLineSourceKey(
  line: Pick<DocumentFormLine, 'sourceKind' | 'sourceBalanceId'>,
) {
  return `${line.sourceKind}:${line.sourceBalanceId}`;
}

export function findStockSourceForLine(
  sources: AvailableStockSource[],
  line: DocumentFormLine,
) {
  return sources.find((source) => stockSourceKey(source) === documentLineSourceKey(line)) ??
    sources.find((source) =>
      source.sourceKind === line.sourceKind &&
      source.inventoryItem.id === line.inventoryItemId &&
      source.accountingOwner.id === line.accountingOwnerResponsiblePersonId,
    );
}

export function sourceSupportsDocument(
  source: AvailableStockSource,
  type: StockDocumentType,
) {
  return type === 'ASSIGNMENT' ? source.canAssign : type === 'ISSUE' ? source.canIssue : false;
}

export function availableSourceOptions(
  sources: AvailableStockSource[],
  selectedSourceKeys: string[],
  type?: StockDocumentType,
) {
  const selected = new Set(selectedSourceKeys);
  return sources.filter((source) =>
    Number(source.availableQuantity) > 0 &&
    !selected.has(stockSourceKey(source)) &&
    (!type || sourceSupportsDocument(source, type)),
  );
}

export function filterStockSources(
  sources: AvailableStockSource[],
  selectedSourceKeys: string[],
  search: string,
  sourceFilter: StockSourceFilter,
  type: StockDocumentType,
) {
  const needle = search.trim().toLocaleLowerCase('uk-UA');
  return availableSourceOptions(sources, selectedSourceKeys, type)
    .filter((source) => sourceFilter === 'ALL' || source.sourceKind === sourceFilter)
    .filter((source) => !needle || stockSourceSearchText(source).includes(needle))
    .sort((left, right) =>
      left.inventoryItem.externalCode.localeCompare(
        right.inventoryItem.externalCode,
        'uk-UA',
        { numeric: true },
      ) || left.inventoryItem.name.localeCompare(right.inventoryItem.name, 'uk-UA'),
    );
}

export function stockSourceSearchText(source: AvailableStockSource) {
  return [
    source.inventoryItem.externalCode,
    source.inventoryItem.name,
    source.accountingOwner.personnelNumber,
    source.accountingOwner.fullName,
  ].filter(Boolean).join(' ').toLocaleLowerCase('uk-UA');
}

export function stockSourceKindLabel(sourceKind: AvailableStockSource['sourceKind']) {
  return sourceKind === 'DIRECT' ? 'Безпосередньо у мене' : 'Закріплено за мною';
}

export function canOpenSourcePicker(sourceReady: boolean) {
  return sourceReady;
}

export function sourceToDocumentLine(source: AvailableStockSource): DocumentFormLine {
  return {
    inventoryItemId: source.inventoryItem.id,
    sourceKind: source.sourceKind,
    sourceBalanceId: source.sourceBalanceId,
    accountingOwnerResponsiblePersonId: source.accountingOwner.id,
    sourceCustodianResponsiblePersonId:
      source.sourceKind === 'ASSIGNED' ? source.currentCustodian.id : undefined,
    sourceCustodyBalanceId:
      source.sourceKind === 'ASSIGNED' ? source.sourceBalanceId : undefined,
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

export function removeDocumentLine(lines: DocumentFormLine[], index: number) {
  return lines.filter((_, currentIndex) => currentIndex !== index);
}
