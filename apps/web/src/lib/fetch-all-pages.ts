import type { PaginatedResponse } from './types';

export const MAX_API_PAGE_SIZE = 100;
const MAX_PAGES = 1000;

export async function fetchAllPages<T extends { id: string }>(
  fetchPage: (query: {
    page: number;
    limit: number;
  }) => Promise<PaginatedResponse<T>>,
) {
  const records = new Map<string, T>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetchPage({ page, limit: MAX_API_PAGE_SIZE });
    response.items.forEach((item) => records.set(item.id, item));

    if (
      response.items.length === 0 ||
      page >= response.pagination.totalPages ||
      response.items.length < MAX_API_PAGE_SIZE
    ) {
      return [...records.values()];
    }
  }

  throw new Error('Не вдалося завершити завантаження всіх сторінок');
}
