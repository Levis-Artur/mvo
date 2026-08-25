export type EntityStatus = boolean;

export type UserRole =
  | 'OWNER'
  | 'AUDITOR'
  | 'ACCOUNTANT'
  | 'DPP_ADMIN'
  | 'MVO'
  | 'ORG_MANAGER';

export type UserAccessScopeInput = {
  managementId: string | null;
  serviceCode: string | null;
};

export type UserAccessScope = UserAccessScopeInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  responsiblePersonId: string | null;
  accessScopes?: UserAccessScopeInput[];
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
    | 'id'
    | 'lastName'
    | 'firstName'
    | 'middleName'
    | 'personnelNumber'
    | 'externalAccountingCode'
    | 'isActive'
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
  externalAccountingName: string | null;
  externalAccountingCode: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  managementId: string;
  serviceId: string;
  unitId: string | null;
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
  externalAccountingCode: string;
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
  | 'ISSUE_REVERSAL'
  | 'MVO_TRANSFER_OUT'
  | 'MVO_TRANSFER_REVERSAL'
  | 'ISSUE_OUT'
  | 'IMPORT_RECEIPT';

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
    externalAccountingCode: string | null;
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
  externalAccountingCode: string | null;
};

export type StockSourceKind = 'DIRECT' | 'ASSIGNED';
export type StockDocumentType =
  | 'TRANSFER'
  | 'ASSIGNMENT'
  | 'MVO_TRANSFER'
  | 'ISSUE';
export type StockDocumentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type AccountingExportState = 'NOT_EXPORTED' | 'EXPORTED';

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
  sourceBalanceId: string | null;
  sourceTransferLineId?: string | null;
  quantityBefore: string | null;
  quantityAfter: string | null;
  issuedQuantity?: string | null;
  availableToIssue?: string | null;
  realizedQuantity?: string | null;
  availableToRealize?: string | null;
  inventoryItem: InventoryItem;
};

export type IssueRealizationStatus = 'POSTED' | 'CANCELLED';

export type IssueRealizationAttachment = {
  id: string;
  realizationId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedByUserId: string;
  createdAt: string;
};

export type IssueRealization = {
  id: string;
  issueId: string;
  displayNumber: number;
  realizationDate: string;
  recipientText: string | null;
  note: string | null;
  status: IssueRealizationStatus;
  createdByUserId: string;
  cancelledByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  createdByUser: Pick<AuthUser, 'id' | 'username' | 'role'>;
  cancelledByUser: Pick<AuthUser, 'id' | 'username' | 'role'> | null;
  lines: {
    id: string;
    issueLineId: string;
    quantity: string;
    inventoryItem: InventoryItem;
  }[];
  attachments: IssueRealizationAttachment[];
  totalQuantity: string;
  hasAttachment: boolean;
  createdBy: Pick<AuthUser, 'id' | 'username' | 'role'>;
};

export type CreateIssueRealizationInput = {
  realizationDate: string;
  recipientText?: string;
  note?: string;
  lines: { issueLineId: string; quantity: string }[];
};

export type StockDocument = {
  id: string;
  documentNumber: string;
  displayNumber: number;
  documentDate: string;
  type: StockDocumentType;
  status: StockDocumentStatus;
  sourceResponsiblePersonId: string;
  sourceTransferId?: string | null;
  destinationResponsiblePersonId: string | null;
  recipientName: string | null;
  recipientUnit: string | null;
  basis: string | null;
  note: string | null;
  postedAt: string | null;
  cancelledAt: string | null;
  accountingExportState: AccountingExportState;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceResponsiblePerson: ResponsiblePerson;
  destinationResponsiblePerson: ResponsiblePerson | null;
  createdByUser: Pick<AuthUser, 'id' | 'username' | 'role'>;
  postedByUser: Pick<AuthUser, 'id' | 'username' | 'role'> | null;
  cancelledByUser: Pick<AuthUser, 'id' | 'username' | 'role'> | null;
  lines: StockDocumentLine[];
  sourceTransfer?: (Pick<
    StockDocument,
    'id' | 'displayNumber' | 'documentDate' | 'status'
  > & {
    sourceResponsiblePerson: ResponsiblePerson;
    destinationResponsiblePerson: ResponsiblePerson | null;
  }) | null;
  issues?: StockDocument[];
  realizations?: IssueRealization[];
  attachments: StockDocumentAttachment[];
  issuedQuantity?: string | null;
  realizedQuantity?: string | null;
  availableToRealize?: string | null;
  realizationCount?: number;
  isFullyRealized?: boolean;
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
    sourceBalanceId?: string;
    note?: string;
  }[];
};

export type CreateMvoTransferInput = {
  documentDate: string;
  destinationResponsiblePersonId: string;
  note?: string;
  lines: StockDocumentInput['lines'];
};

export type CreateIssueInput = {
  documentDate: string;
  recipientName: string;
  recipientUnit?: string;
  basis?: string;
  note?: string;
  lines: {
    inventoryItemId: string;
    sourceBalanceId: string;
    quantity: string;
    note?: string;
  }[];
};

export type AvailableStockSource = {
  inventoryItem: Pick<InventoryItem, 'id' | 'externalCode' | 'name' | 'unitOfMeasure'>;
  balanceId: string;
  availableQuantity: string;
  unit: string | null;
  canTransfer: boolean;
  canIssue: boolean;
};

export type MyPropertySection = 'DIRECT' | 'TRANSFERRED';
export type MyPropertyExportSection = 'ALL' | MyPropertySection;
export type MyPropertySortBy =
  | 'code'
  | 'name'
  | 'quantity'
  | 'documentDate'
  | 'documentNumber'
  | 'recipient';
export type SortOrder = 'asc' | 'desc';

export type DirectMyPropertyItem = {
  section: 'DIRECT';
  id: string;
  inventoryItem: Pick<InventoryItem, 'id' | 'externalCode' | 'name' | 'unitOfMeasure'>;
  quantity: string;
  unrealizedQuantity: string;
  updatedAt: string;
};

export type TransferredMyPropertyItem = {
  section: 'TRANSFERRED';
  id: string;
  inventoryItem: Pick<InventoryItem, 'id' | 'externalCode' | 'name' | 'unitOfMeasure'>;
  quantity: string;
  issuedQuantity: string;
  availableToIssue: string;
  document: Pick<
    StockDocument,
    'id' | 'displayNumber' | 'documentDate' | 'type' | 'status'
  >;
  recipient: PersonReference | null;
};

export type MyPropertyItem = DirectMyPropertyItem | TransferredMyPropertyItem;
export type MyPropertyResponse = PaginatedResponse<MyPropertyItem>;

export type MyInventoryItemTransferHistoryItem = {
  documentId: string;
  displayNumber: number;
  documentDate: string;
  status: Extract<StockDocumentStatus, 'POSTED' | 'CANCELLED'>;
  quantity: string;
  recipient: {
    id: string;
    externalAccountingCode: string | null;
    fullName: string;
  } | null;
};

export type MyInventoryItemTransferHistory = {
  inventoryItem: {
    id: string;
    code: string;
    name: string;
    unit: string | null;
  };
  currentBalance: string;
  items: MyInventoryItemTransferHistoryItem[];
  pagination: Pagination;
};

export type MyInventoryItemMovementHistory = {
  inventoryItem: {
    id: string;
    code: string;
    name: string;
    unit: string | null;
  };
  currentBalance: string;
  items: InventoryItemMovement[];
  pagination: Pagination;
};

export type InventoryItemTransferHistory = {
  inventoryItem: {
    id: string;
    code: string;
    name: string;
    unit: string | null;
  };
  items: Array<{
    documentId: string;
    displayNumber: number;
    documentDate: string;
    status: Extract<StockDocumentStatus, 'POSTED' | 'CANCELLED'>;
    quantity: string;
    sender: {
      id: string;
      externalAccountingCode: string | null;
      fullName: string;
    };
    recipient: {
      id: string;
      externalAccountingCode: string | null;
      fullName: string;
    } | null;
  }>;
  pagination: Pagination;
};

export type MyPropertyQuery = {
  search?: string;
  section: MyPropertySection;
  page: number;
  limit: number;
  sortBy: MyPropertySortBy;
  sortOrder: SortOrder;
};

export type LegacyCustodyArchiveEntry = {
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
  legacyCustodyArchive: LegacyCustodyArchiveEntry[];
  totalDirectQuantity: string;
  recentTransfers: AccountingCardDocument[];
  recentIssues: AccountingCardDocument[];
};

export type InventoryItemAccountingCard = {
  inventoryItem: InventoryItem;
  totals: {
    currentQuantity: string;
    responsiblePersons: number;
  };
  currentBalances: {
    id: string;
    responsiblePerson: PersonReference & {
      management: Pick<Management, 'id' | 'name'>;
      service: Pick<Service, 'id' | 'name'>;
      unit: Pick<Unit, 'id' | 'name'> | null;
    };
    quantity: string;
    updatedAt: string;
  }[];
  movements: PaginatedResponse<InventoryItemMovement>;
  documents: PaginatedResponse<InventoryItemCardDocument>;
};

export type InventoryMovementCategory =
  | 'IMPORT'
  | 'MANUAL_RECEIPT'
  | 'MVO_TRANSFER'
  | 'ISSUE'
  | 'MVO_TRANSFER_REVERSAL'
  | 'ISSUE_REVERSAL'
  | 'LEGACY';

export type InventoryItemMovement = {
  id: string;
  occurredAt: string;
  category: InventoryMovementCategory;
  typeLabel: string;
  from: string;
  to: string;
  quantity: string;
  balanceBefore: string;
  balanceAfter: string;
  documentNumber: string;
  source: string;
  note: string | null;
  user: string | null;
  responsiblePerson: PersonReference & {
    management: Pick<Management, 'id' | 'name'>;
    service: Pick<Service, 'id' | 'name'>;
    unit: Pick<Unit, 'id' | 'name'> | null;
  };
  documentId: string | null;
  importBatchId: string | null;
};

export type InventoryItemCardDocument = {
  kind: 'IMPORT' | 'STOCK_DOCUMENT';
  id: string;
  occurredAt: string;
  title: string;
  typeLabel: string;
  statusLabel: string;
  from: string;
  to: string;
  quantity: string;
  attachments: Pick<
    StockDocumentAttachment,
    'id' | 'originalFileName' | 'mimeType' | 'sizeBytes' | 'createdAt'
  >[];
};

export type InventoryItemAccountingCardQuery = {
  movementPage?: number;
  movementLimit?: number;
  documentPage?: number;
  documentLimit?: number;
  dateFrom?: string;
  dateTo?: string;
  movementType?: InventoryMovementCategory;
  responsiblePersonId?: string;
  documentNumber?: string;
};

export type InventoryItemMovementFilters = Pick<
  InventoryItemAccountingCardQuery,
  | 'dateFrom'
  | 'dateTo'
  | 'movementType'
  | 'responsiblePersonId'
  | 'documentNumber'
>;

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

export type IssueHistoryFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: StockDocumentStatus;
  hasAttachment?: boolean;
};

export type IssueHistoryQuery = IssueHistoryFilters & {
  page?: number;
  limit?: 25 | 50 | 100;
};

export type IssueHistoryItem = {
  id: string;
  displayNumber: number;
  documentDate: string;
  sourceResponsiblePerson: PersonReference;
  recipientName: string | null;
  note: string | null;
  status: StockDocumentStatus;
  numberOfLines: number;
  totalQuantity: string;
  issuedQuantity: string;
  realizedQuantity: string;
  availableToRealize: string;
  realizationCount: number;
  isFullyRealized: boolean;
  hasAttachment: boolean;
  createdBy: Pick<AuthUser, 'id' | 'username' | 'role'>;
  createdAt: string;
};

export type AccountingTransferFilters = {
  dateFrom?: string;
  dateTo?: string;
  sourceResponsiblePersonId?: string;
  destinationResponsiblePersonId?: string;
  inventoryItemId?: string;
  status?: StockDocumentStatus;
  exportState?: AccountingExportState;
  documentNumber?: string;
};

export type AccountingTransferExportFilters = Omit<
  AccountingTransferFilters,
  'status' | 'exportState'
>;

export type AccountingTransferRow = {
  documentId: string;
  displayNumber: number;
  documentDate: string;
  status: StockDocumentStatus;
  exportState: AccountingExportState;
  exportedAt: string | null;
  postedAt: string | null;
  sourceResponsiblePerson: PersonReference & {
    management: Pick<Management, 'id' | 'name'>;
  };
  destinationResponsiblePerson: (PersonReference & {
    management: Pick<Management, 'id' | 'name'>;
  }) | null;
  totalPositions: number;
  totalQuantity: string;
  issuedQuantity: string;
  availableToIssue: string;
};

export type AccountingOverview = {
  metrics: {
    activeResponsiblePersons: number;
    inventoryItems: number;
    unexportedTransfers: number;
    currentMonthTransactions: number;
  };
  lastImport: {
    id: string;
    originalFilename: string;
    status: ImportStatus;
    createdAt: string;
    completedAt: string | null;
  } | null;
  recentOperations: {
    id: string;
    type: StockTransactionType;
    quantity: string;
    occurredAt: string;
    sourceDocument: string | null;
    comment: string | null;
    document: { displayNumber: number } | null;
    responsiblePerson: {
      personnelNumber: string;
      externalAccountingCode: string | null;
      lastName: string;
      firstName: string;
      middleName: string | null;
    };
    inventoryItem: {
      externalCode: string;
      name: string;
      unitOfMeasure: string | null;
    };
  }[];
};

export type AccountingMovementType =
  | 'IMPORT'
  | 'MVO_TRANSFER'
  | 'ISSUE';

export type AccountingMovementFilters = {
  dateFrom?: string;
  dateTo?: string;
  operationType?: AccountingMovementType;
  responsiblePersonId?: string;
  destinationResponsiblePersonId?: string;
  mvoCode?: string;
  inventoryCode?: string;
  inventoryName?: string;
  transferRecipient?: string;
  issueRecipient?: string;
  status?: 'POSTED' | 'CANCELLED' | 'COMPLETED';
  search?: string;
};

export type AccountingMovementPerson = {
  id: string;
  personnelNumber: string;
  externalAccountingCode: string | null;
  fullName: string;
};

export type AccountingMovementRow = {
  id: string;
  occurredAt: string;
  operationType: AccountingMovementType;
  operationLabel: string;
  documentLabel: string;
  documentId: string | null;
  responsiblePerson: AccountingMovementPerson;
  inventoryItem: Pick<
    InventoryItem,
    'id' | 'externalCode' | 'name' | 'unitOfMeasure'
  >;
  quantity: string;
  direction: string;
  transferredTo: AccountingMovementPerson | null;
  issuedTo: string | null;
  relatedDocument: {
    id: string;
    displayNumber: number;
    label: string;
  } | null;
  hasAttachment: boolean;
  status: StockDocumentStatus | ImportStatus;
  statusLabel: string;
};

export type AccountingMovementDetails = {
  kind: 'IMPORT' | 'STOCK_DOCUMENT';
  sourceId: string;
  documentType: StockDocumentType | null;
  operationType: AccountingMovementType;
  documentLabel: string;
  documentDate: string;
  status: StockDocumentStatus | ImportStatus;
  author: { id: string; username: string } | null;
  responsiblePerson: AccountingMovementPerson;
  destinationResponsiblePerson: AccountingMovementPerson | null;
  sourceTransfer: {
    id: string;
    displayNumber: number;
    documentDate: string;
    status: StockDocumentStatus;
    sourceResponsiblePerson: AccountingMovementPerson;
    destinationResponsiblePerson: AccountingMovementPerson | null;
  } | null;
  counterparty: Pick<
    AccountingMovementPerson,
    'fullName' | 'externalAccountingCode'
  > | null;
  recipientUnit: string | null;
  basis: string | null;
  note: string | null;
  lines: {
    inventoryItem: Pick<
      InventoryItem,
      'id' | 'externalCode' | 'name' | 'unitOfMeasure'
    >;
    responsiblePerson: AccountingMovementPerson;
    quantity: string;
    issuedQuantity: string | null;
    availableToIssue: string | null;
    note: string | null;
  }[];
  attachments: StockDocumentAttachment[];
  issues: {
    id: string;
    displayNumber: number;
    documentDate: string;
    status: StockDocumentStatus;
    recipientName: string | null;
    author: { id: string; username: string };
    quantity: string;
    lines: {
      inventoryItem: Pick<
        InventoryItem,
        'id' | 'externalCode' | 'name' | 'unitOfMeasure'
      >;
      quantity: string;
    }[];
    attachments: StockDocumentAttachment[];
  }[];
};

export type AccountingTransferExportBatch = {
  id: string;
  filename: string;
  documentCount: number;
  rowCount: number;
  sha256: string;
  formatVersion: number;
  filters: Record<string, unknown>;
  createdAt: string;
  createdByUser: Pick<UserSummary, 'id' | 'username' | 'role'>;
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
    externalAccountingCode: string | null;
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
  uploadedByUser?: Pick<AuthUser, 'id' | 'username'> | null;
  preview?: {
    validRows: number;
    warningRows: number;
    errorRows: number;
    skippedRows: number;
    importedRows: number;
    newItems: number;
    updatedItems: number;
    matchedPersons: number;
    missingPersons: number;
  };
};

export type ImportRow = {
  id: string;
  rowNumber: number;
  status: ImportRowStatus;
  counterpartyRaw: string;
  externalAccountingCode: string | null;
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
    externalAccountingCode: string | null;
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
  externalAccountingCode: string;
  managementId: string;
  serviceId: string;
  unitId?: string | null;
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
