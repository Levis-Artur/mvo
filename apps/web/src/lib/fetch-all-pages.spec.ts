import { fetchAllPages, MAX_API_PAGE_SIZE } from './fetch-all-pages';

describe('fetchAllPages', () => {
  it('ніколи не використовує limit понад 100 і завантажує кілька сторінок', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) => ({
          id: `person-${index}`,
        })),
        pagination: { page: 1, limit: 100, total: 201, totalPages: 3 },
      })
      .mockResolvedValueOnce({
        items: [
          { id: 'person-99' },
          ...Array.from({ length: 99 }, (_, index) => ({
            id: `person-${index + 100}`,
          })),
        ],
        pagination: { page: 2, limit: 100, total: 201, totalPages: 3 },
      })
      .mockResolvedValueOnce({
        items: [{ id: 'person-200' }],
        pagination: { page: 3, limit: 100, total: 201, totalPages: 3 },
      });

    const result = await fetchAllPages(fetchPage);

    expect(MAX_API_PAGE_SIZE).toBe(100);
    expect(fetchPage.mock.calls.map(([query]) => query)).toEqual([
      { page: 1, limit: 100 },
      { page: 2, limit: 100 },
      { page: 3, limit: 100 },
    ]);
    expect(result).toHaveLength(200);
    expect(new Set(result.map((item) => item.id)).size).toBe(result.length);
  });

  it('передає API-помилку виклику вище для показу користувачу', async () => {
    await expect(
      fetchAllPages(async () => {
        throw new Error('Сервіс тимчасово недоступний');
      }),
    ).rejects.toThrow('Сервіс тимчасово недоступний');
  });
});
