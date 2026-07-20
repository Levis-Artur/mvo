import type { DownloadedFile } from '@/lib/api-client';
import type {
  MyPropertyExportSection,
  MyPropertyItem,
  MyPropertySection,
  MyPropertySortBy,
  SortOrder,
} from '@/lib/types';

export const MY_PROPERTY_SECTION_LABELS: Record<MyPropertySection, string> = {
  DIRECT: 'Безпосередньо у мене',
  ASSIGNED_OUT: 'Закріплено за іншими',
  ASSIGNED_TO_ME: 'Закріплено за мною',
};

export const MY_PROPERTY_SORT_LABELS: Record<MyPropertySortBy, string> = {
  code: 'Код',
  name: 'Назва',
  quantity: 'Кількість',
  accountingOwner: 'Обліковий власник',
  currentCustodian: 'Фактичний утримувач',
};

export function normalizedPropertySearch(search: string) {
  return search.trim();
}

export function exportSection(
  scope: 'ALL' | 'CURRENT',
  currentSection: MyPropertySection,
): MyPropertyExportSection {
  return scope === 'ALL' ? 'ALL' : currentSection;
}

export function propertyActionLinks(item: MyPropertyItem) {
  const source = encodeURIComponent(item.currentCustodian.id);
  const balance = encodeURIComponent(item.sourceBalanceId);
  return {
    transfer: `/transfers?create=ASSIGNMENT&sourceResponsiblePersonId=${source}&sourceBalanceId=${balance}`,
    issue: `/transfers?create=ISSUE&sourceResponsiblePersonId=${source}&sourceBalanceId=${balance}`,
  };
}

export type FileDownloadEnvironment = {
  createObjectUrl: (blob: Blob) => string;
  triggerDownload: (url: string, filename: string) => void;
  revokeObjectUrl: (url: string) => void;
};

export function deliverDownloadedFile(
  file: DownloadedFile,
  environment: FileDownloadEnvironment,
) {
  const url = environment.createObjectUrl(file.blob);
  try {
    environment.triggerDownload(url, file.filename);
  } finally {
    environment.revokeObjectUrl(url);
  }
}

export function downloadFileInBrowser(file: DownloadedFile) {
  deliverDownloadedFile(file, {
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    triggerDownload: (url, filename) => {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    },
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  });
}

export const DEFAULT_MY_PROPERTY_SORT: {
  sortBy: MyPropertySortBy;
  sortOrder: SortOrder;
} = { sortBy: 'name', sortOrder: 'asc' };
