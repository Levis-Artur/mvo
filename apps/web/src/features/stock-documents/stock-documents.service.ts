import { apiClient } from '@/lib/api-client';

export const stockDocumentsService = {
  list: apiClient.stockDocuments,
  findOne: apiClient.stockDocument,
  create: apiClient.createStockDocument,
  update: apiClient.updateStockDocument,
  remove: apiClient.deleteStockDocument,
  post: apiClient.postStockDocument,
  cancel: apiClient.cancelStockDocument,
  persons: apiClient.responsiblePersons,
  transferTargets: apiClient.transferTargets,
  balances: apiClient.stockBalances,
  person: apiClient.responsiblePerson,
  personAccountingCard: apiClient.responsiblePersonAccountingCard,
  availableToMe: apiClient.availableStockToMe,
  attachments: apiClient.stockDocumentAttachments,
  uploadAttachment: apiClient.uploadStockDocumentAttachment,
  removeAttachment: apiClient.deleteStockDocumentAttachment,
  attachmentDownloadUrl: apiClient.stockDocumentAttachmentDownloadUrl,
};
