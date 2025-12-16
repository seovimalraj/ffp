/**
 * Metadata keys used for decorators and reflection
 */
export enum MetaNames {
  /** Key for storing role metadata in decorators */
  rolesMetaKey = 'roles',
  /** Key for storing permission metadata in decorators */
  permissionsMetaKey = 'permissions',
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
}

/**
 * Enum representing different types of stock materials
 */

export enum StockMaterial {
  Block = 'block',
  Rod = 'rod',
  Plate = 'plate',
}

/**
 * Materialized view names for optimized queries
 */
export enum MaterializedViewNames {
  /** Materialized view containing user permission codes for fast lookup */
  userPermissionCodesMV = 'user_permission_codes_mv',
}

export enum SQLFunctions {
  userPermissionCodesMVRefresh = 'refresh_user_permission_codes_mv',
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
  storage = 'demo bucket',
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
