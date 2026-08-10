import { apiClient } from '@/lib/api-client';

export const accountingMovementsService = {
  list: apiClient.accountingMovements,
  details: apiClient.accountingMovementDetails,
  documentDetails: apiClient.accountingDocumentDetails,
  exportCsv: apiClient.exportAccountingMovements,
  persons: apiClient.responsiblePersons,
  attachmentDownloadUrl: apiClient.stockDocumentAttachmentDownloadUrl,
  previewAttachment: apiClient.previewStockDocumentAttachment,
};
