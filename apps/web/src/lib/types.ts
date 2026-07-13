export type EntityStatus = boolean;

export type Management = {
  id: string;
  name: string;
  shortName: string | null;
  code: string;
  isActive: EntityStatus;
  createdAt: string;
  updatedAt: string;
  services?: Service[];
};

export type Service = {
  id: string;
  name: string;
  code: string;
  managementId: string;
  isActive: EntityStatus;
  createdAt: string;
  updatedAt: string;
  management?: Pick<Management, 'id' | 'name'>;
  units?: Unit[];
};

export type Unit = {
  id: string;
  name: string;
  code: string;
  serviceId: string;
  isActive: EntityStatus;
  createdAt: string;
  updatedAt: string;
  service?: Pick<Service, 'id' | 'name'> & {
    management?: Pick<Management, 'id' | 'name'>;
  };
};

export type ResponsiblePerson = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  personnelNumber: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  managementId: string;
  serviceId: string;
  unitId: string | null;
  appointmentOrderNumber: string | null;
  appointmentDate: string | null;
  isActive: EntityStatus;
  createdAt: string;
  updatedAt: string;
  management: Pick<Management, 'id' | 'name'>;
  service: Pick<Service, 'id' | 'name'>;
  unit: Pick<Unit, 'id' | 'name'> | null;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};

export type DashboardStats = {
  activeResponsiblePersons: number;
  managements: number;
  services: number;
  units: number;
  inventoryItems: number;
  inventoryItemsNeedsReview: number;
  responsiblePersonsWithStock: number;
  completedImports: number;
  importsWithErrors: number;
  recentReceiptDiscrepancies: number;
};

export type InventoryItemReviewStatus = 'VERIFIED' | 'NEEDS_REVIEW';
export type ImportType = 'INITIAL_BALANCE' | 'RECEIPT';
export type ImportStatus =
  | 'UPLOADED'
  | 'VALIDATED'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED';
export type ImportRowStatus =
  'VALID' | 'WARNING' | 'ERROR' | 'SKIPPED' | 'IMPORTED';
export type StockTransactionType =
  | 'INITIAL_BALANCE'
  | 'RECEIPT'
  | 'MANUAL_RECEIPT'
  | 'ADJUSTMENT_INCREASE'
  | 'ADJUSTMENT_DECREASE';

export type InventoryItem = {
  id: string;
  externalCode: string;
  name: string;
  unitOfMeasure: string | null;
  category: string | null;
  description: string | null;
  reviewStatus: InventoryItemReviewStatus;
  isActive: boolean;
  createdManually: boolean;
  createdAt: string;
  updatedAt: string;
  totalQuantity?: string;
  responsiblePersonsCount?: number;
};

export type StockBalance = {
  id: string;
  quantity: string;
  updatedAt: string;
  responsiblePerson: {
    id: string;
    fullName: string;
    personnelNumber: string;
  };
  inventoryItem: Pick<
    InventoryItem,
    'id' | 'externalCode' | 'name' | 'unitOfMeasure'
  >;
};

export type StockTransaction = {
  id: string;
  type: StockTransactionType;
  quantity: string;
  balanceBefore: string;
  balanceAfter: string;
  occurredAt: string;
  sourceDocument: string | null;
  comment: string | null;
  importBatchId: string | null;
  createdAt: string;
  responsiblePerson: {
    id: string;
    fullName: string;
    personnelNumber: string;
  };
  inventoryItem: Pick<
    InventoryItem,
    'id' | 'externalCode' | 'name' | 'unitOfMeasure'
  >;
};

export type ImportBatch = {
  id: string;
  type: ImportType;
  status: ImportStatus;
  originalFilename: string;
  fileHash: string;
  fileSize: number;
  encoding: string;
  delimiter: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  importedRows: number;
  createdAt: string;
  completedAt: string | null;
  preview?: {
    validRows: number;
    warningRows: number;
    errorRows: number;
    skippedRows: number;
    importedRows: number;
    newItems: number;
    matchedPersons: number;
    missingPersons: number;
  };
};

export type ImportRow = {
  id: string;
  rowNumber: number;
  status: ImportRowStatus;
  counterpartyRaw: string;
  nomenclatureCodeRaw: string;
  itemNameRaw: string;
  unitOfMeasureRaw: string | null;
  debitQuantityRaw: string | null;
  endingQuantityRaw: string | null;
  parsedQuantity: string | null;
  message: string | null;
  systemBalance: string | null;
  fileEndingBalance: string | null;
  balanceDifference: string | null;
  responsiblePerson: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
    personnelNumber: string;
  } | null;
  inventoryItem: Pick<
    InventoryItem,
    'id' | 'externalCode' | 'name' | 'unitOfMeasure'
  > | null;
};

export type CreateManagementDto = {
  name: string;
  shortName?: string | null;
  code: string;
  isActive?: boolean;
};

export type UpdateManagementDto = Partial<CreateManagementDto>;

export type CreateServiceDto = {
  name: string;
  code: string;
  managementId: string;
  isActive?: boolean;
};

export type UpdateServiceDto = Partial<CreateServiceDto>;

export type CreateUnitDto = {
  name: string;
  code: string;
  serviceId: string;
  isActive?: boolean;
};

export type UpdateUnitDto = Partial<CreateUnitDto>;

export type CreateResponsiblePersonDto = {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  personnelNumber: string;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  externalAccountingName?: string | null;
  externalAccountingCode?: string | null;
  managementId: string;
  serviceId: string;
  unitId?: string | null;
  appointmentOrderNumber?: string | null;
  appointmentDate?: string | null;
  isActive?: boolean;
};

export type UpdateResponsiblePersonDto = Partial<CreateResponsiblePersonDto>;

export type ResponsiblePersonsQuery = {
  search?: string;
  managementId?: string;
  serviceId?: string;
  unitId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export type CreateInventoryItemDto = {
  externalCode: string;
  name: string;
  unitOfMeasure?: string | null;
  category?: string | null;
  description?: string | null;
  reviewStatus?: InventoryItemReviewStatus;
  isActive?: boolean;
};

export type UpdateInventoryItemDto = Partial<CreateInventoryItemDto>;

export type InventoryItemsQuery = {
  search?: string;
  reviewStatus?: InventoryItemReviewStatus;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export type StockBalancesQuery = {
  search?: string;
  responsiblePersonId?: string;
  inventoryItemId?: string;
  managementId?: string;
  serviceId?: string;
  unitId?: string;
  onlyPositive?: boolean;
  page?: number;
  limit?: number;
};

export type StockTransactionsQuery = {
  responsiblePersonId?: string;
  inventoryItemId?: string;
  type?: StockTransactionType;
  importBatchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};
