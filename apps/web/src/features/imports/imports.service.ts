import { apiClient } from '@/lib/api-client';

export const importsService = {
  imports: apiClient.imports,
  getImportBatch: apiClient.getImportBatch,
  getImportRows: apiClient.getImportRows,
  responsiblePersons: apiClient.responsiblePersons,
  updateImportMappings: apiClient.updateImportMappings,
  validateImport: apiClient.validateImport,
  commitImport: apiClient.commitImport,
  cancelImport: apiClient.cancelImport,
  uploadImport: apiClient.uploadImport,
  rollbackImport: apiClient.rollbackImport,
};
