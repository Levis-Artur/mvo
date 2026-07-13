import type {
  CreateManagementDto,
  CreateInventoryItemDto,
  CreateResponsiblePersonDto,
  CreateServiceDto,
  CreateUnitDto,
  DashboardStats,
  ImportBatch,
  ImportRow,
  ImportType,
  InventoryItem,
  InventoryItemsQuery,
  Management,
  PaginatedResponse,
  ResponsiblePerson,
  ResponsiblePersonsQuery,
  Service,
  StockBalance,
  StockBalancesQuery,
  StockTransaction,
  StockTransactionsQuery,
  Unit,
  UpdateInventoryItemDto,
  UpdateManagementDto,
  UpdateResponsiblePersonDto,
  UpdateServiceDto,
  UpdateUnitDto,
} from './types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type QueryValue = string | number | boolean | null | undefined;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(
    `${apiBaseUrl}${path}`,
    typeof window === 'undefined' ? 'http://mvo.local' : window.location.origin,
  );

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  if (apiBaseUrl.startsWith('/')) {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  query?: Record<string, QueryValue>,
): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = 'Помилка запиту до сервера';

    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join('; ');
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

async function uploadRequest<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    let message = 'Помилка завантаження файлу';
    try {
      const payload = (await response.json()) as {
        message?: string | string[];
      };
      message = Array.isArray(payload.message)
        ? payload.message.join('; ')
        : (payload.message ?? message);
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

function mutation<TBody>(method: 'POST' | 'PATCH', body: TBody): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
  };
}

export const apiClient = {
  dashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  managements: () => request<Management[]>('/managements'),
  management: (id: string) => request<Management>(`/managements/${id}`),
  createManagement: (body: CreateManagementDto) =>
    request<Management>('/managements', mutation('POST', body)),
  updateManagement: (id: string, body: UpdateManagementDto) =>
    request<Management>(`/managements/${id}`, mutation('PATCH', body)),

  services: (query?: { managementId?: string }) =>
    request<Service[]>('/services', {}, query),
  service: (id: string) => request<Service>(`/services/${id}`),
  createService: (body: CreateServiceDto) =>
    request<Service>('/services', mutation('POST', body)),
  updateService: (id: string, body: UpdateServiceDto) =>
    request<Service>(`/services/${id}`, mutation('PATCH', body)),

  units: (query?: { managementId?: string; serviceId?: string }) =>
    request<Unit[]>('/units', {}, query),
  unit: (id: string) => request<Unit>(`/units/${id}`),
  createUnit: (body: CreateUnitDto) =>
    request<Unit>('/units', mutation('POST', body)),
  updateUnit: (id: string, body: UpdateUnitDto) =>
    request<Unit>(`/units/${id}`, mutation('PATCH', body)),

  responsiblePersons: (query: ResponsiblePersonsQuery) =>
    request<PaginatedResponse<ResponsiblePerson>>(
      '/responsible-persons',
      {},
      query,
    ),
  responsiblePerson: (id: string) =>
    request<ResponsiblePerson>(`/responsible-persons/${id}`),
  createResponsiblePerson: (body: CreateResponsiblePersonDto) =>
    request<ResponsiblePerson>('/responsible-persons', mutation('POST', body)),
  updateResponsiblePerson: (id: string, body: UpdateResponsiblePersonDto) =>
    request<ResponsiblePerson>(
      `/responsible-persons/${id}`,
      mutation('PATCH', body),
    ),

  inventoryItems: (query: InventoryItemsQuery) =>
    request<PaginatedResponse<InventoryItem>>('/inventory-items', {}, query),
  createInventoryItem: (body: CreateInventoryItemDto) =>
    request<InventoryItem>('/inventory-items', mutation('POST', body)),
  updateInventoryItem: (id: string, body: UpdateInventoryItemDto) =>
    request<InventoryItem>(`/inventory-items/${id}`, mutation('PATCH', body)),

  stockBalances: (query: StockBalancesQuery) =>
    request<PaginatedResponse<StockBalance>>('/stock-balances', {}, query),
  stockTransactions: (query: StockTransactionsQuery) =>
    request<PaginatedResponse<StockTransaction>>(
      '/stock-transactions',
      {},
      query,
    ),
  manualReceipt: (body: {
    responsiblePersonId: string;
    inventoryItemId: string;
    quantity: string;
    occurredAt: string;
    sourceDocument?: string;
    comment?: string;
  }) =>
    request<StockTransaction>(
      '/stock-transactions/manual-receipt',
      mutation('POST', body),
    ),

  imports: (query: { page?: number; limit?: number }) =>
    request<PaginatedResponse<ImportBatch>>('/imports', {}, query),
  importBatch: (id: string) => request<ImportBatch>(`/imports/${id}`),
  getImportBatch: (id: string) => request<ImportBatch>(`/imports/${id}`),
  importRows: (
    id: string,
    query: { status?: string; search?: string; page?: number; limit?: number },
  ) => request<PaginatedResponse<ImportRow>>(`/imports/${id}/rows`, {}, query),
  getImportRows: (
    id: string,
    query: { status?: string; search?: string; page?: number; limit?: number },
  ) => request<PaginatedResponse<ImportRow>>(`/imports/${id}/rows`, {}, query),
  updateImportMappings: (
    id: string,
    body: {
      mappings: {
        counterpartyRaw: string;
        responsiblePersonId: string;
        saveExternalAccountingName?: boolean;
      }[];
    },
  ) => request<ImportBatch>(`/imports/${id}/mappings`, mutation('PATCH', body)),
  validateImport: (id: string) =>
    request<ImportBatch>(`/imports/${id}/validate`, { method: 'POST' }),
  uploadImport: (file: File, importType: ImportType) => {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('importType', importType);
    return uploadRequest<ImportBatch>('/imports/upload', formData);
  },
  commitImport: (id: string) =>
    request<ImportBatch>(`/imports/${id}/commit`, { method: 'POST' }),
  cancelImport: (id: string) =>
    request<ImportBatch>(`/imports/${id}/cancel`, { method: 'POST' }),
  getResponsiblePersonStockBalances: (
    id: string,
    query: { search?: string; page?: number; limit?: number },
  ) =>
    request<PaginatedResponse<StockBalance>>(
      `/responsible-persons/${id}/stock-balances`,
      {},
      query,
    ),
  getResponsiblePersonStockTransactions: (
    id: string,
    query: { page?: number; limit?: number },
  ) =>
    request<PaginatedResponse<StockTransaction>>(
      `/responsible-persons/${id}/stock-transactions`,
      {},
      query,
    ),
};
