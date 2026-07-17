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
  transferTargets: apiClient.responsiblePersons,
  balances: apiClient.stockBalances,
};
