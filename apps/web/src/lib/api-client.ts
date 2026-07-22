import type {
  CreateManagementDto,
  CreateInventoryItemDto,
  CreateResponsiblePersonDto,
  CreateServiceDto,
  CreateUnitDto,
  AuthUser,
  AdminEntityType,
  AccountingTransferExportBatch,
  AccountingTransferExportFilters,
  AccountingTransferFilters,
  AccountingTransferRow,
  DashboardStats,
  DeletionPreview,
  ImportBatch,
  ImportRow,
  ImportType,
  AvailableStockSource,
  InventoryItem,
  InventoryItemAccountingCard,
  InventoryItemAccountingCardQuery,
  InventoryItemMovementFilters,
  InventoryItemsQuery,
  Management,
  MyPropertyExportSection,
  MyPropertyQuery,
  MyPropertyResponse,
  PaginatedResponse,
  ResponsiblePerson,
  ResponsiblePersonAccountingCard,
  ResponsiblePersonsQuery,
  Service,
  StockBalance,
  StockBalancesQuery,
  StockDocument,
  StockDocumentAttachment,
  StockDocumentInput,
  StockDocumentsQuery,
  StockTransaction,
  StockTransactionsQuery,
  TransferTarget,
  Unit,
  UpdateInventoryItemDto,
  UpdateManagementDto,
  UpdateResponsiblePersonDto,
  UpdateServiceDto,
  UpdateUnitDto,
  UserRole,
  UserSummary,
} from './types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type QueryValue = string | number | boolean | null | undefined;

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNIQUE_CONSTRAINT_VIOLATION'
  | 'FOREIGN_KEY_CONSTRAINT_VIOLATION'
  | 'RECORD_NOT_FOUND'
  | 'HTTP_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export type ApiErrorPayload = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details: unknown;
  path: string;
  requestId: string;
  timestamp: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ApiErrorCode = 'UNKNOWN_ERROR',
    public readonly requestId?: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function createApiError(
  response: Response,
  fallbackMessage: string,
): Promise<ApiError> {
  try {
    const payload = (await response.json()) as Partial<ApiErrorPayload>;

    if (typeof payload.message === 'string') {
      return new ApiError(
        payload.message,
        response.status,
        isApiErrorCode(payload.code) ? payload.code : 'UNKNOWN_ERROR',
        typeof payload.requestId === 'string'
          ? payload.requestId
          : (response.headers.get('x-request-id') ?? undefined),
        payload.details ?? null,
      );
    }
  } catch {
    // The fallback below also handles non-JSON proxy and network responses.
  }

  return new ApiError(
    fallbackMessage,
    response.status,
    'UNKNOWN_ERROR',
    response.headers.get('x-request-id') ?? undefined,
  );
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === 'string' &&
    [
      'VALIDATION_ERROR',
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'UNIQUE_CONSTRAINT_VIOLATION',
      'FOREIGN_KEY_CONSTRAINT_VIOLATION',
      'RECORD_NOT_FOUND',
      'HTTP_ERROR',
      'INTERNAL_SERVER_ERROR',
      'UNKNOWN_ERROR',
    ].includes(value)
  );
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
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw await createApiError(response, 'Помилка запиту до сервера');
  }

  return (await response.json()) as T;
}

async function uploadRequest<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    credentials: 'include',
    body,
  });

  if (!response.ok) {
    throw await createApiError(response, 'Помилка завантаження файлу');
  }

  return (await response.json()) as T;
}

function mutation<TBody>(
  method: 'POST' | 'PATCH' | 'DELETE',
  body: TBody,
): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
  };
}

export type DownloadedFile = {
  blob: Blob;
  filename: string;
};

async function downloadRequest(
  path: string,
  query?: Record<string, QueryValue>,
): Promise<DownloadedFile> {
  const response = await fetch(buildUrl(path, query), {
    credentials: 'include',
  });
  if (!response.ok) {
    throw await createApiError(response, 'Не вдалося завантажити файл');
  }
  return {
    blob: await response.blob(),
    filename: responseFilename(response.headers.get('content-disposition')) ?? 'download.csv',
  };
}

function responseFilename(contentDisposition: string | null) {
  if (!contentDisposition) return null;
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { return encoded; }
  }
  return contentDisposition.match(/filename="([^"]+)"/i)?.[1] ?? null;
}

export const apiClient = {
  login: (body: { username: string; password: string }) =>
    request<{ user: AuthUser }>('/auth/login', mutation('POST', body)),
  logout: () => request<{ status: 'ok' }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: AuthUser }>('/auth/me'),
  changePassword: (body: { oldPassword: string; newPassword: string }) =>
    request<{ user: AuthUser }>('/auth/change-password', mutation('POST', body)),
  logoutAll: () =>
    request<{ status: 'ok' }>('/auth/logout-all', { method: 'POST' }),
  users: () => request<UserSummary[]>('/users'),
  user: (id: string) => request<UserSummary>(`/users/${id}`),
  createUser: (body: {
    username: string;
    role?: UserRole;
    responsiblePersonId?: string;
  }) =>
    request<{ user: UserSummary; temporaryPassword: string }>(
      '/users',
      mutation('POST', body),
    ),
  updateUser: (
    id: string,
    body: {
      username?: string;
      role?: UserRole;
      responsiblePersonId?: string | null;
      mustChangePassword?: boolean;
    },
  ) => request<UserSummary>(`/users/${id}`, mutation('PATCH', body)),
  resetUserPassword: (id: string) =>
    request<{ user: UserSummary; temporaryPassword: string }>(
      `/users/${id}/reset-password`,
      { method: 'POST' },
    ),
  blockUser: (id: string) =>
    request<UserSummary>(`/users/${id}/block`, { method: 'POST' }),
  unblockUser: (id: string) =>
    request<UserSummary>(`/users/${id}/unblock`, { method: 'POST' }),
  revokeUserSessions: (id: string) =>
    request<{ status: 'ok' }>(`/users/${id}/revoke-sessions`, {
      method: 'POST',
    }),
  deactivateUser: (id: string) =>
    request<UserSummary>(`/users/${id}/deactivate`, { method: 'POST' }),
  activateUser: (id: string) =>
    request<UserSummary>(`/users/${id}/activate`, { method: 'POST' }),

  deletionPreview: (entityType: AdminEntityType, id: string) =>
    request<DeletionPreview>(
      `/admin/deletion-preview/${entityType}/${encodeURIComponent(id)}`,
    ),
  deleteAdminEntity: (
    entityType: AdminEntityType,
    id: string,
    force: boolean,
  ) =>
    request<{ success: boolean }>(
      `/admin/${entityType}/${encodeURIComponent(id)}`,
      mutation('DELETE', {
        force,
        confirmation: `DELETE ${entityType}:${id}`,
      }),
    ),
  rollbackImport: (id: string) =>
    request<ImportBatch>(`/admin/imports/${encodeURIComponent(id)}/rollback`, {
      method: 'POST',
    }),
  resetTestData: () =>
    request<{ success: boolean }>(
      '/admin/test-data/reset',
      mutation('POST', { confirmation: 'DELETE TEST DATA' }),
    ),

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
  transferTargets: (query: ResponsiblePersonsQuery) =>
    request<PaginatedResponse<TransferTarget>>(
      '/responsible-persons/transfer-targets',
      {},
      query,
    ),
  responsiblePerson: (id: string) =>
    request<ResponsiblePerson>(`/responsible-persons/${id}`),
  responsiblePersonAccountingCard: (id: string) =>
    request<ResponsiblePersonAccountingCard>(
      `/responsible-persons/${id}/accounting-card`,
    ),
  createResponsiblePerson: (body: CreateResponsiblePersonDto) =>
    request<ResponsiblePerson>('/responsible-persons', mutation('POST', body)),
  updateResponsiblePerson: (id: string, body: UpdateResponsiblePersonDto) =>
    request<ResponsiblePerson>(
      `/responsible-persons/${id}`,
      mutation('PATCH', body),
    ),

  inventoryItems: (query: InventoryItemsQuery) =>
    request<PaginatedResponse<InventoryItem>>('/inventory-items', {}, query),
  inventoryItemAccountingCard: (
    id: string,
    query: InventoryItemAccountingCardQuery = {},
  ) =>
    request<InventoryItemAccountingCard>(
      `/inventory-items/${id}/accounting-card`,
      {},
      query,
    ),
  exportInventoryItemHistoryCsv: (
    id: string,
    query: InventoryItemMovementFilters,
  ) =>
    downloadRequest(
      `/inventory-items/${id}/accounting-card/movements/export.csv`,
      query,
    ),
  createInventoryItem: (body: CreateInventoryItemDto) =>
    request<InventoryItem>('/inventory-items', mutation('POST', body)),
  updateInventoryItem: (id: string, body: UpdateInventoryItemDto) =>
    request<InventoryItem>(`/inventory-items/${id}`, mutation('PATCH', body)),

  stockBalances: (query: StockBalancesQuery) =>
    request<PaginatedResponse<StockBalance>>('/stock-balances', {}, query),
  availableStockToMe: () =>
    request<AvailableStockSource[]>('/stock/available-to-me'),
  myProperty: (query: MyPropertyQuery) =>
    request<MyPropertyResponse>('/stock/my-property', {}, query),
  exportMyPropertyCsv: (query: { search?: string; section: MyPropertyExportSection }) =>
    downloadRequest('/stock/my-property/export.csv', query),
  stockTransactions: (query: StockTransactionsQuery) =>
    request<PaginatedResponse<StockTransaction>>(
      '/stock-transactions',
      {},
      query,
    ),
  stockDocuments: (query: StockDocumentsQuery) =>
    request<PaginatedResponse<StockDocument>>('/stock-documents', {}, query),
  accountingMvoTransfers: (
    query: AccountingTransferFilters & { page?: number; limit?: number },
  ) =>
    request<PaginatedResponse<AccountingTransferRow>>(
      '/accounting/mvo-transfers',
      {},
      query,
    ),
  exportAccountingMvoTransfers: (query: AccountingTransferExportFilters) =>
    downloadRequest('/accounting/mvo-transfers/export.csv', query),
  accountingMvoTransferExportBatches: (query: { page?: number; limit?: number }) =>
    request<PaginatedResponse<AccountingTransferExportBatch>>(
      '/accounting/mvo-transfer-exports',
      {},
      query,
    ),
  downloadAccountingMvoTransferExportBatch: (id: string) =>
    downloadRequest(`/accounting/mvo-transfer-exports/${encodeURIComponent(id)}/download`),
  stockDocument: (id: string) =>
    request<StockDocument>(`/stock-documents/${id}`),
  createStockDocument: (body: StockDocumentInput) =>
    request<StockDocument>('/stock-documents', mutation('POST', body)),
  updateStockDocument: (id: string, body: StockDocumentInput) =>
    request<StockDocument>(`/stock-documents/${id}`, mutation('PATCH', body)),
  deleteStockDocument: (id: string) =>
    request<{ success: boolean }>(`/stock-documents/${id}`, {
      method: 'DELETE',
    }),
  postStockDocument: (id: string) =>
    request<StockDocument>(`/stock-documents/${id}/post`, {
      method: 'POST',
    }),
  cancelStockDocument: (id: string) =>
    request<StockDocument>(`/stock-documents/${id}/cancel`, {
      method: 'POST',
    }),
  stockDocumentAttachments: (id: string) =>
    request<StockDocumentAttachment[]>(`/stock-documents/${id}/attachments`),
  uploadStockDocumentAttachment: (id: string, file: File) => {
    const formData = new FormData();
    formData.set('file', file);
    return uploadRequest<StockDocumentAttachment>(
      `/stock-documents/${id}/attachments`,
      formData,
    );
  },
  deleteStockDocumentAttachment: (documentId: string, attachmentId: string) =>
    request<{ success: boolean }>(
      `/stock-documents/${documentId}/attachments/${attachmentId}`,
      { method: 'DELETE' },
    ),
  stockDocumentAttachmentDownloadUrl: (documentId: string, attachmentId: string) =>
    buildUrl(`/stock-documents/${documentId}/attachments/${attachmentId}/download`),
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
