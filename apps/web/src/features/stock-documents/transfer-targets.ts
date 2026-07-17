import { fetchAllPages } from '../../lib/fetch-all-pages';
import type { PaginatedResponse, ResponsiblePerson, ResponsiblePersonsQuery } from '../../lib/types';

export function loadTransferTargets(
  fetchPage: (query: ResponsiblePersonsQuery) => Promise<PaginatedResponse<ResponsiblePerson>>,
) {
  return fetchAllPages((pagination) => fetchPage({ ...pagination, isActive: true }));
}
