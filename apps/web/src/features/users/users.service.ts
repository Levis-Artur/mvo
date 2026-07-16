import { apiClient } from '@/lib/api-client';

export const usersService = {
  users: apiClient.users,
  createUser: apiClient.createUser,
  updateUser: apiClient.updateUser,
  resetUserPassword: apiClient.resetUserPassword,
  activateUser: apiClient.activateUser,
  deactivateUser: apiClient.deactivateUser,
  blockUser: apiClient.blockUser,
  unblockUser: apiClient.unblockUser,
  revokeUserSessions: apiClient.revokeUserSessions,
  responsiblePersons: apiClient.responsiblePersons,
};
