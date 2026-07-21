import type { DownloadedFile } from '@/lib/api-client';
import type {
  MyPropertyExportSection,
  MyPropertyItem,
  MyPropertySection,
  MyPropertySortBy,
  SortOrder,
} from '@/lib/types';

export const MY_PROPERTY_SECTION_LABELS: Record<MyPropertySection, string> = {
  DIRECT: 'У мене',
  ASSIGNED_OUT: 'Передано іншим МВО',
  ASSIGNED_TO_ME: 'Отримано від інших МВО',
};

export const MY_PROPERTY_SECTION_DESCRIPTIONS: Record<MyPropertySection, string> = {
  DIRECT: 'Майно, яке зараз знаходиться безпосередньо у вас.',
  ASSIGNED_OUT: 'Ваше майно, яке зараз знаходиться в інших матеріально відповідальних осіб.',
  ASSIGNED_TO_ME: 'Майно інших МВО, яке зараз знаходиться у вас.',
};

export function myPropertySortOptions(section: MyPropertySection): { value: MyPropertySortBy; label: string }[] {
  const common: { value: MyPropertySortBy; label: string }[] = [
    { value: 'code', label: 'Код' },
    { value: 'name', label: 'Назва' },
    { value: 'quantity', label: 'Кількість' },
  ];
  if (section === 'ASSIGNED_OUT') return [...common, { value: 'currentCustodian', label: 'У кого знаходиться' }];
  if (section === 'ASSIGNED_TO_ME') return [...common, { value: 'accountingOwner', label: 'Від кого отримано' }];
  return common;
}

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
    transfer: `/transfers?create=ASSIGNMENT&sourceResponsiblePersonId=${source}&sourceBalanceId=${balance}&sourceKind=${item.sourceKind}`,
    issue: `/transfers?create=ISSUE&sourceResponsiblePersonId=${source}&sourceBalanceId=${balance}&sourceKind=${item.sourceKind}`,
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
