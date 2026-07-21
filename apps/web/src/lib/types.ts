export type EntityStatus = boolean;

export type UserRole = 'OWNER' | 'AUDITOR' | 'ACCOUNTANT' | 'DPP_ADMIN' | 'MVO';

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  responsiblePersonId: string | null;
  lastLoginAt?: string | null;
};

export type UserSummary = AuthUser & {
  failedLoginAttempts: number;
  lockedUntil: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  responsiblePerson: Pick<
    ResponsiblePerson,
    'id' | 'lastName' | 'firstName' | 'middleName' | 'personnelNumber' | 'isActive'
  > | null;
};

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

export type TransferTarget = {
  id: string;
  personnelNumber: string;
  fullName: string;
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
  | 'CANCELLED'
  | 'ROLLED_BACK';

export type AdminEntityType =
  | 'imports'
  | 'responsible-persons'
  | 'managements'
  | 'services'
  | 'units'
  | 'users'
  | 'inventory-items';

export type DeletionPreview = {
  entityType: AdminEntityType;
  entityId: string;
  displayName: string;
  canDelete: boolean;
  blockers: string[];
  dependencies: {
    type: string;
    count: number;
    action: 'BLOCK' | 'DELETE' | 'DETACH' | 'RETAIN';
  }[];
};
export type ImportRowStatus =
  'VALID' | 'WARNING' | 'ERROR' | 'SKIPPED' | 'IMPORTED';
export type StockTransactionType =
  | 'INITIAL_BALANCE'
  | 'RECEIPT'
  | 'MANUAL_RECEIPT'
  | 'ADJUSTMENT_INCREASE'
  | 'ADJUSTMENT_DECREASE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ISSUE'
  | 'DOCUMENT_REVERSAL'
  | 'ASSIGNMENT_OUT_DIRECT'
  | 'ASSIGNMENT_OUT_CUSTODY'
  | 'ASSIGNMENT_IN_DIRECT'
  | 'ASSIGNMENT_IN_CUSTODY'
  | 'ISSUE_FROM_DIRECT'
  | 'ISSUE_FROM_CUSTODY'
  | 'ASSIGNMENT_REVERSAL'
  | 'ISSUE_REVERSAL';

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
  directQuantity: string;
  assignedToOthersQuantity: string;
  totalAccountedQuantity: string;
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

export type PersonReference = {
  id: string;
  fullName: string;
  personnelNumber: string;
};

export type StockSourceKind = 'DIRECT' | 'ASSIGNED';
export type StockDocumentType = 'TRANSFER' | 'ASSIGNMENT' | 'ISSUE';
export type StockDocumentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type StockDocumentAttachment = {
  id: string;
  documentId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedByUserId: string;
  uploadedByUser?: Pick<AuthUser, 'id' | 'username'>;
  createdAt: string;
};

export type StockDocumentLine = {
  id: string;
  inventoryItemId: string;
  quantity: string;
  note: string | null;
  sourceKind: StockSourceKind | null;
  accountingOwnerResponsiblePersonId: string | null;
  sourceCustodianResponsiblePersonId: string | null;
  sourceCustodyBalanceId: string | null;
  inventoryItem: InventoryItem;
};

export type StockDocument = {
  id: string;
  documentNumber: string;
  displayNumber: number;
  documentDate: string;
  type: StockDocumentType;
  status: StockDocumentStatus;
  sourceResponsiblePersonId: string;
  destinationResponsiblePersonId: string | null;
  recipientName: string | null;
  recipientUnit: string | null;
  basis: string | null;
  note: string | null;
  postedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceResponsiblePerson: ResponsiblePerson;
  destinationResponsiblePerson: ResponsiblePerson | null;
  createdByUser: Pick<AuthUser, 'id' | 'username' | 'role'>;
  postedByUser: Pick<AuthUser, 'id' | 'username' | 'role'> | null;
  cancelledByUser: Pick<AuthUser, 'id' | 'username' | 'role'> | null;
  lines: StockDocumentLine[];
  attachments: StockDocumentAttachment[];
  totalPositions: number;
  totalQuantity: string;
};

export type StockDocumentInput = {
  documentNumber?: string;
  documentDate: string;
  type: StockDocumentType;
  sourceResponsiblePersonId: string;
  destinationResponsiblePersonId?: string;
  recipientName?: string;
  recipientUnit?: string;
  basis?: string;
  note?: string;
  lines: {
    inventoryItemId: string;
    quantity: string;
    sourceKind?: StockSourceKind;
    accountingOwnerResponsiblePersonId?: string;
    sourceCustodianResponsiblePersonId?: string;
    sourceCustodyBalanceId?: string;
    note?: string;
  }[];
};

export type AvailableStockSource = {
  sourceKind: StockSourceKind;
  inventoryItem: Pick<InventoryItem, 'id' | 'externalCode' | 'name' | 'unitOfMeasure'>;
  accountingOwner: PersonReference;
  currentCustodian: PersonReference;
  availableQuantity: string;
  sourceBalanceId: string;
  canAssign: boolean;
  canIssue: boolean;
};

export type MyPropertySection = 'DIRECT' | 'ASSIGNED_OUT' | 'ASSIGNED_TO_ME';
export type MyPropertyExportSection = 'ALL' | MyPropertySection;
export type MyPropertySortBy =
  | 'code'
  | 'name'
  | 'quantity'
  | 'accountingOwner'
  | 'currentCustodian';
export type SortOrder = 'asc' | 'desc';

export type MyPropertyPerson = PersonReference & {
  management: string | null;
  service: string | null;
  unit: string | null;
};

export type MyPropertyItem = {
  section: MyPropertySection;
  sourceKind: StockSourceKind;
  sourceBalanceId: string;
  inventoryItem: Pick<InventoryItem, 'id' | 'externalCode' | 'name' | 'unitOfMeasure'>;
  accountingOwner: MyPropertyPerson;
  currentCustodian: MyPropertyPerson;
  quantity: string;
  canAssign: boolean;
  canIssue: boolean;
  updatedAt: string;
};

export type MyPropertySummary = {
  directCount: number;
  assignedOutCount: number;
  assignedToMeCount: number;
  directQuantity: string;
  assignedOutQuantity: string;
  assignedToMeQuantity: string;
  totalOwnedAccountingQuantity: string;
  totalPhysicallyHeldQuantity: string;
};

export type MyPropertyResponse = PaginatedResponse<MyPropertyItem> & {
  summary: MyPropertySummary;
};

export type MyPropertyQuery = {
  search?: string;
  section: MyPropertySection;
  page: number;
  limit: number;
  sortBy: MyPropertySortBy;
  sortOrder: SortOrder;
};

export type CustodyBalanceView = {
  id: string;
  inventoryItem: InventoryItem;
  accountingOwner: PersonReference;
  custodian: PersonReference;
  quantity: string;
  updatedAt: string;
};

export type AccountingCardDocument = {
  id: string;
  documentNumber: string;
  displayNumber: number;
  documentDate: string;
  type: StockDocumentType;
  status: StockDocumentStatus;
  sourceResponsiblePerson: PersonReference;
  destinationResponsiblePerson: PersonReference | null;
  lines: {
    id: string;
    inventoryItem?: InventoryItem;
    inventoryItemId?: string;
    quantity: string;
    accountingOwnerResponsiblePersonId?: string | null;
  }[];
};

export type ResponsiblePersonAccountingCard = {
  directBalances: { id: string; inventoryItem: InventoryItem; quantity: string }[];
  assignedToOthers: CustodyBalanceView[];
  assignedToMe: CustodyBalanceView[];
  totalOwnedAccountingQuantity: string;
  totalPhysicallyHeldQuantity: string;
  recentAssignments: AccountingCardDocument[];
  recentIssues: AccountingCardDocument[];
};

export type InventoryItemAccountingCard = {
  inventoryItem: InventoryItem;
  totals: {
    directQuantity: string;
    assignedQuantity: string;
    totalAccountedQuantity: string;
  };
  directBalances: { responsiblePerson: PersonReference; quantity: string }[];
  custodyBalances: {
    accountingOwner: PersonReference;
    custodian: PersonReference;
    quantity: string;
  }[];
  recentDocuments: AccountingCardDocument[];
  recentTransactions: (StockTransaction & {
    accountingOwner: PersonReference | null;
    sourceCustodian: PersonReference | null;
    destinationCustodian: PersonReference | null;
  })[];
};

export type StockDocumentsQuery = {
  type?: StockDocumentType;
  status?: StockDocumentStatus;
  sourceResponsiblePersonId?: string;
  destinationResponsiblePersonId?: string;
  documentDateFrom?: string;
  documentDateTo?: string;
  page?: number;
  limit?: number;
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
  documentId?: string | null;
  documentLineId?: string | null;
  accountingModel?: 'LEGACY_BALANCE' | 'OWNER_CUSTODY' | null;
  bucketKind?: StockSourceKind | null;
  accountingOwnerResponsiblePersonId?: string | null;
  sourceCustodianResponsiblePersonId?: string | null;
  destinationCustodianResponsiblePersonId?: string | null;
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
