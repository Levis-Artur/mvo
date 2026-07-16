import { apiClient } from '@/lib/api-client';

export const organizationService = {
  managements: apiClient.managements,
  createManagement: apiClient.createManagement,
  updateManagement: apiClient.updateManagement,
  createService: apiClient.createService,
  updateService: apiClient.updateService,
  createUnit: apiClient.createUnit,
  updateUnit: apiClient.updateUnit,
};
