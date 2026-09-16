import { apiClient } from '@/lib/api-client';

export const stockDocumentsService = {
  list: apiClient.stockDocuments,
  issueHistory: apiClient.issueHistory,
  exportIssueHistory: apiClient.exportIssueHistory,
  findOne: apiClient.stockDocument,
  createAndPostMvoTransfer: apiClient.createAndPostMvoTransfer,
  createAndPostIssue: apiClient.createAndPostIssue,
  cancel: apiClient.cancelStockDocument,
  issueRealizations: apiClient.issueRealizations,
  createIssueRealization: apiClient.createIssueRealization,
  cancelIssueRealization: apiClient.cancelIssueRealization,
  realizationAttachmentDownloadUrl:
    apiClient.issueRealizationAttachmentDownloadUrl,
  previewRealizationAttachment: apiClient.previewIssueRealizationAttachment,
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
  previewAttachment: apiClient.previewStockDocumentAttachment,
};
