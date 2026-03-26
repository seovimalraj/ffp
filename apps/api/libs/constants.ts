/**
 * Metadata keys used for decorators and reflection
 */
export enum MetaNames {
  /** Key for storing role metadata in decorators */
  rolesMetaKey = 'roles',
  /** Key for storing permission metadata in decorators */
  permissionsMetaKey = 'permissions',
}

export enum TaskQueues {
  CoreTaskQueue = 'quote-tasks',
  CADTaskQueue = 'cad-tasks',
}

/**
 * Database table names used throughout the application
 */
export enum Tables {
  /** Table storing user account information */
  UserTable = 'users',
  /** Table storing organization details */
  OrganizationTable = 'organizations',
  /** Table storing role definitions */
  RolesTable = 'roles',
  /** Table storing permission definitions */
  PermissionsTable = 'permissions',
  /** Junction table linking organizations with their general roles */
  GeneralOrganizationRolesTable = 'general_organization_roles',
  /** Junction table linking roles with their permissions */
  RolePermissionsTable = 'role_permissions',
  /** Table storing refresh tokens for authentication */
  RefreshTokensTable = 'refresh_tokens',

  GeneralMaterialsTable = 'general_materials',

  MaterialCategories = 'material_categories',

  SupplierMaterials = 'supplier_materials',

  Warehouses = 'warehouses',

  MaterialTable = 'material',

  GeneralTolerancesTable = 'general_tolerances',

  RFQTable = 'rfq',

  RFQPartsTable = 'rfq_parts',

  RFQPartDrawing2DTable = 'part_drawing_2d',

  AbandonedRFQPartsTable = 'abandoned_rfq_parts',

  AbandonedPartDrawing2DTable = 'abandoned_part_drawing_2d',

  ShippingAddressTable = 'shipping_addresses',

  OrdersTable = 'orders',

  OrderPartsTable = 'order_parts',

  OrderPartStatusHistoryTable = 'order_part_status_history',

  OrderShippingTable = 'order_shipping',

  OrderPaymentsTable = 'order_payments',

  OrganizationAgreementsTable = 'organization_agreements',

  OrderDocumentsTable = 'order_documents',

  ManualQuoteApproval = 'manual_quote_approval',

  DfmFilesTable = 'dfm_files',

  OTPTable = 'otps',

  SystemConfig = 'system_config',

  TechnicalSupportRequest = 'technical_support_request ',

  UploadsTable = 'uploads',

  BlogsTable = 'blogs',

  ProductionOrderRequest = 'production_order_request',

  OrderStatusChangeRequests = 'order_status_change_requests',

  SupplierAssignments = 'supplier_assignments',

  QuoteRequest = 'quote_request',

  QuoteRequestEvent = 'quote_request_event',
}

/**
 * Enum representing different types of stock materials
 */

export enum StockMaterial {
  Block = 'block',
  Rod = 'rod',
  Plate = 'plate',
}

export enum InngestEvents {
  EmailEvent = 'system/email.send',
  ManualQuoteApproval = 'rfq/manual-quote.approval',
}

export enum TemporalEvents {
  SendEmailWorkflow = 'sendEmailWorkflow',
  ReviewManualQuoteWorkflow = 'reviewManualQuoteWorkflow',
  OtpWorkflow = 'otpWorkflow',
  OrderPartStatusChangeWorkflow = 'orderPartStatusChangeWorkflow',
  TechnicalSupportWorkflow = 'technicalSupportWorkflow',
  CADProcessingWorkflow = 'cadProcessingWorkflow',
  ProductionRequestWorkflow = 'productionRequestWorkflow',
  SupplierAssignmentWorkflow = 'supplierAssignmentWorkflow',
  OrderStatusChangeRequestWorkflow = 'orderStatusChangeRequestWorkflow',
  SupplierWelcomeWorkflow = 'supplierWelcomeWorkflow',
  QuoteRequestWorkflow = 'quoteRequestWorkflow',
}

/**
 * Materialized view names for optimized queries
 */
export enum MaterializedViewNames {
  /** Materialized view containing user permission codes for fast lookup */
  userPermissionCodesMV = 'user_permission_codes_mv',
}

export enum SQLFunctions {
  createUser = 'create_user',
  CreateSupplier = 'create_supplier',
  userPermissionCodesMVRefresh = 'refresh_user_permission_codes_mv',

  createInitialRFQ = 'create_initial_rfq',
  abandonRFQPart = 'abandon_rfq_part',
  abandonRFQParts = 'abandon_rfq_parts',
  getUserRFQsWithPartsCount = 'get_user_rfqs_with_parts_count',
  CreateManualQuotes = 'create_manual_quotes',

  createOrder = 'create_order',
  markOrderPaid = 'mark_order_paid',
  getOrders = 'get_orders',
  getOrderDetails = 'get_order_details',
  updateOrderStatus = 'update_order_status',
  updateOrderPartStatus = 'update_order_part_status',
  markOrderAsFailure = 'mark_order_payment_failed',

  getRFQPartsInfinite = 'get_rfq_parts_infinite',
  getUserRFQsWithPartsCountInfinite = 'get_user_rfqs_with_parts_count_infinite_v2',
  getOrdersInfinite = 'get_orders_infinite',

  getRfqStatusCounts = 'get_rfq_status_counts',
  getRfqStatusSummary = 'get_rfq_status_summary',
  getOrderStatusSummary = 'get_order_status_summary',
  regenerateOtp = 'regenerate_otp',

  createTechRequest = 'create_tech_request',
  assignSupplierToOrder = 'assign_supplier_to_order',
  getSupplierOrderMetrics = 'get_supplier_order_metrics',
}

/**
 * Standard role names used in the system
 */
export enum RoleNames {
  /** Administrator role with elevated privileges */
  Admin = 'admin',
  /** Supplier role for vendor users */
  Supplier = 'supplier',
  /** Customer role for end users */
  Customer = 'customer',
}

export enum BucketNames {
  storage = 'ffp',
  rfqStore = 'ffp-rfq-store',
  cadFiles = 'cad-files',
}

export type CurrencyType = 'USD' | 'INR' | 'EUR';
export type UnitType = 'kg' | 'tons' | 'liters' | 'pieces';

/**
 * Permission names following hierarchical naming convention
 * Format: [domain].[action].[scope]
 */
export enum PermissionsNames {
  /** Full administrative access to all system functions */
  adminFullAccess = 'admin.access.allmight',
  /** Full access to organization-level functions */
  organizationFullAccess = 'org.access.allmight',

  //   Warehouse permissions
  warehouseFullAccess = 'warehouse.access.allmight',
  warehouseReadAccess = 'warehouse.access.read',
  warehouseWriteAccess = 'warehouse.access.write',

  //   Material permissions
  materialReadAccess = 'material.access.read',
  materialWriteAccess = 'material.access.write',
}

/**
 * Permission aliases mapping for grouping related permissions
 * Key: alias name, Value: array of permission names
 *
 * Example usage:
 * PERMISSION_ALIASES['user_management'] = ['user.create', 'user.read', 'user.update']
 */
export const PERMISSION_ALIASES: Record<string, string[]> = {
  // Warehouse permissions
  'warehouse.access.read': [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
    PermissionsNames.warehouseFullAccess,
  ],
  'warehouse.access.write': [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
    PermissionsNames.warehouseFullAccess,
  ],
  'warehouse.access.allmight': [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
    PermissionsNames.warehouseFullAccess,
  ],

  // Material permissions
  'material.access.read': [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
  ],
  'material.access.write': [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
  ],
  'material.access.allmight': [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
  ],
};
