/**
 * Metadata keys used for decorators and reflection
 */
export enum MetaNames {
  /** Key for storing role metadata in decorators */
  rolesMetaKey = "roles",
  /** Key for storing permission metadata in decorators */
  permissionsMetaKey = "permissions",
}

/**
 * Enum representing different types of stock materials
 */

export enum StockMaterial {
  Block = "block",
  Rod = "rod",
  Plate = "plate",
}

export const LOGO_URL =
  "https://frigate.ai/wp-content/uploads/2024/03/frigate_whitelogo.svg";

/**
 * Materialized view names for optimized queries
 */
export enum MaterializedViewNames {
  /** Materialized view containing user permission codes for fast lookup */
  userPermissionCodesMV = "user_permission_codes_mv",
}

export enum SQLFunctions {
  userPermissionCodesMVRefresh = "refresh_user_permission_codes_mv",
}

/**
 * Standard role names used in the system
 */
export enum RoleNames {
  /** Administrator role with elevated privileges */
  Admin = "admin",
  /** Supplier role for vendor users */
  Supplier = "supplier",
  /** Customer role for end users */
  Customer = "customer",
}

export type CurrencyType = "USD" | "INR";
export type UnitType = "kg" | "tons" | "liters" | "pieces";

/**
 * Permission names following hierarchical naming convention
 * Format: [domain].[action].[scope]
 */
export enum PermissionsNames {
  /** Full administrative access to all system functions */
  adminFullAccess = "admin.access.allmight",
  /** Full access to organization-level functions */
  organizationFullAccess = "org.access.allmight",

  //   Warehouse permissions
  warehouseFullAccess = "warehouse.access.allmight",
  warehouseReadAccess = "warehouse.access.read",
  warehouseWriteAccess = "warehouse.access.write",

  //   Material permissions
  materialReadAccess = "material.access.read",
  materialWriteAccess = "material.access.write",
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
  "warehouse.access.read": [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
    PermissionsNames.warehouseFullAccess,
  ],
  "warehouse.access.write": [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
    PermissionsNames.warehouseFullAccess,
  ],
  "warehouse.access.allmight": [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
    PermissionsNames.warehouseFullAccess,
  ],

  // Material permissions
  "material.access.read": [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
  ],
  "material.access.write": [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
  ],
  "material.access.allmight": [
    PermissionsNames.adminFullAccess,
    PermissionsNames.organizationFullAccess,
  ],
};

export const leadTimeMeta = {
  economy: {
    badge: "Best Value",
    badgeClass: "bg-slate-100 text-slate-600",
  },
  standard: {
    badge: "Most Popular",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  expedited: {
    badge: "Fastest",
    badgeClass: "bg-slate-100 text-slate-600",
  },
} as const;

export const markupMap = {
  economy: 0.2,
  standard: 0.25,
  expedited: 0.3,
} as const;

export const leadTypeStyles = {
  economy: {
    border: "border-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-600",
    text: "text-emerald-700",
  },
  standard: {
    border: "border-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-600",
    text: "text-blue-700",
  },
  expedited: {
    border: "border-purple-600",
    bg: "bg-purple-50",
    ring: "ring-purple-600",
    text: "text-purple-700",
  },
} as const;

export const metalTranslation = {
  "aluminum-6061": "Aluminum 6061",
  "aluminum-6063": "Aluminum 6063",
  "aluminum-5052": "Aluminum 5052",
  "aluminum-7075": "Aluminum 7075",
  "aluminum-2024": "Aluminum 2024",

  "carbon-steel-a36": "Carbon Steel A36",
  "carbon-steel-1018": "Carbon Steel 1018",
  "carbon-steel-1045": "Carbon Steel 1045",
  "alloy-steel-4140": "Alloy Steel 4140",
  "alloy-steel-4340": "Alloy Steel 4340",

  "stainless-steel-304": "Stainless Steel 304",
  "stainless-steel-316": "Stainless Steel 316",
  "stainless-steel-321": "Stainless Steel 321",
  "stainless-steel-410": "Stainless Steel 410",
  "stainless-steel-430": "Stainless Steel 430",

  "brass-c360": "Brass C360",
  "brass-c260": "Brass C260",

  "copper-c110": "Copper C110",
  "copper-c101": "Copper C101",

  "titanium-grade-2": "Titanium Grade 2",
  "titanium-grade-5": "Titanium Grade 5 (Ti-6Al-4V)",

  abs: "ABS",
  "nylon-6": "Nylon 6",
  "nylon-6-6": "Nylon 6/6",
  polycarbonate: "Polycarbonate",
  "delrin-acetal": "Delrin (Acetal)",
  peek: "PEEK",
  hdpe: "HDPE",
  uhmw: "UHMW",

  "inconel-625": "Inconel 625",
  "inconel-718": "Inconel 718",
  "monel-400": "Monel 400",
  "tool-steel-d2": "Tool Steel D2",
  "tool-steel-h13": "Tool Steel H13",
};
