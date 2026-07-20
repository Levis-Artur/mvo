import { apiClient } from '@/lib/api-client';

export const responsiblePersonsService = {
  managements: apiClient.managements,
  services: apiClient.services,
  units: apiClient.units,
  responsiblePersons: apiClient.responsiblePersons,
  responsiblePerson: apiClient.responsiblePerson,
  responsiblePersonAccountingCard: apiClient.responsiblePersonAccountingCard,
  availableStockToMe: apiClient.availableStockToMe,
  myProperty: apiClient.myProperty,
  exportMyPropertyCsv: apiClient.exportMyPropertyCsv,
  createResponsiblePerson: apiClient.createResponsiblePerson,
  updateResponsiblePerson: apiClient.updateResponsiblePerson,
  createUser: apiClient.createUser,
  users: apiClient.users,
  stockDocuments: apiClient.stockDocuments,
  getResponsiblePersonStockBalances:
    apiClient.getResponsiblePersonStockBalances,
  getResponsiblePersonStockTransactions:
    apiClient.getResponsiblePersonStockTransactions,
};
