import { apiClient } from '@/lib/api-client';

export const accountingMovementsService = {
  list: apiClient.accountingMovements,
  details: apiClient.accountingMovementDetails,
  exportCsv: apiClient.exportAccountingMovements,
  persons: apiClient.responsiblePersons,
  attachmentDownloadUrl: apiClient.stockDocumentAttachmentDownloadUrl,
};
