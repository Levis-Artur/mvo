import { apiClient } from '@/lib/api-client';

export const accountingTransfersService = {
  overview: apiClient.accountingOverview,
  list: apiClient.accountingMvoTransfers,
  exportCsv: apiClient.exportAccountingMvoTransfers,
  batches: apiClient.accountingMvoTransferExportBatches,
  downloadBatch: apiClient.downloadAccountingMvoTransferExportBatch,
  persons: apiClient.responsiblePersons,
  inventoryItems: apiClient.inventoryItems,
};
