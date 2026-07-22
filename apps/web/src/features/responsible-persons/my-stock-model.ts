import type { DownloadedFile } from '@/lib/api-client';
import type {
  MyPropertyExportSection,
  MyPropertySection,
  MyPropertySortBy,
  SortOrder,
} from '@/lib/types';

export const MY_PROPERTY_SECTION_LABELS: Record<MyPropertySection, string> = {
  DIRECT: 'У мене',
  TRANSFERRED: 'Передано іншим МВО',
};

export const MY_PROPERTY_SECTION_DESCRIPTIONS: Record<MyPropertySection, string> = {
  DIRECT: 'Поточний залишок майна за даними обліку.',
  TRANSFERRED: 'Історія проведених і скасованих документів передачі іншим МВО.',
};

export function myPropertySortOptions(
  section: MyPropertySection,
): { value: MyPropertySortBy; label: string }[] {
  const common: { value: MyPropertySortBy; label: string }[] = [
    { value: 'code', label: 'Код' },
    { value: 'name', label: 'Назва' },
    { value: 'quantity', label: 'Кількість' },
  ];
  if (section === 'TRANSFERRED') {
    return [
      ...common,
      { value: 'documentDate', label: 'Дата передачі' },
      { value: 'documentNumber', label: 'Номер документа' },
      { value: 'recipient', label: 'Кому передано' },
    ];
  }
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
