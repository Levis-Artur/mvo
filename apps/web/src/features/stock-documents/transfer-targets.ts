import { fetchAllPages } from '../../lib/fetch-all-pages';
import type { PaginatedResponse, ResponsiblePersonsQuery, TransferTarget } from '../../lib/types';

export function loadTransferTargets(
  fetchPage: (query: ResponsiblePersonsQuery) => Promise<PaginatedResponse<TransferTarget>>,
) {
  return fetchAllPages((pagination) => fetchPage({ ...pagination, isActive: true }));
}
