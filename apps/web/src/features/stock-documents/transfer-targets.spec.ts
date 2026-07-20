import type { PaginatedResponse, ResponsiblePersonsQuery, TransferTarget } from '@/lib/types';
import { loadTransferTargets } from './transfer-targets';

describe('loadTransferTargets', () => {
  it('викликає transfer-targets сторінками не більше 100 записів', async () => {
    const fetchPage = jest.fn(async (query: ResponsiblePersonsQuery): Promise<PaginatedResponse<TransferTarget>> => {
      const page = query.page ?? 1;
      const count = page === 1 ? 100 : 1;
      return {
        items: Array.from({ length: count }, (_, index) => ({ id: `person-${page}-${index}` }) as TransferTarget),
        pagination: { page, limit: query.limit ?? 100, total: 101, totalPages: 2 },
      };
    });
    const result = await loadTransferTargets(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage.mock.calls.every(([query]) => (query.limit ?? 0) <= 100)).toBe(true);
    expect(result).toHaveLength(101);
  });
});
