import { apiClient } from '@/lib/api-client';

export const adminService = {
  deletionPreview: apiClient.deletionPreview,
  deleteEntity: apiClient.deleteAdminEntity,
  rollbackImport: apiClient.rollbackImport,
  resetTestData: apiClient.resetTestData,
};
