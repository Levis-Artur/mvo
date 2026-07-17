import { apiClient } from '@/lib/api-client';

export const inventoryService = {
  inventoryItems: apiClient.inventoryItems,
  createInventoryItem: apiClient.createInventoryItem,
  updateInventoryItem: apiClient.updateInventoryItem,
  stockBalances: apiClient.stockBalances,
  stockTransactions: apiClient.stockTransactions,
  responsiblePersons: apiClient.responsiblePersons,
  managements: apiClient.managements,
  services: apiClient.services,
  units: apiClient.units,
  manualReceipt: apiClient.manualReceipt,
};
