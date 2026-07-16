import { apiClient } from '@/lib/api-client';

export const inventoryService = {
  inventoryItems: apiClient.inventoryItems,
  createInventoryItem: apiClient.createInventoryItem,
  stockBalances: apiClient.stockBalances,
  stockTransactions: apiClient.stockTransactions,
  responsiblePersons: apiClient.responsiblePersons,
  manualReceipt: apiClient.manualReceipt,
};
