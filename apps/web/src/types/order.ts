export interface Order {
  id: string;
  quote_id: string;
  status:
    | "Pending"
    | "In_Production"
    | "QA_Incoming"
    | "QA_Final"
    | "Ready_To_Ship"
    | "Shipped"
    | "Completed"
    | "On_Hold"
    | "Cancelled"
    | "Refunded";
  source: "web" | "widget" | "large_order";
  created_at: string;
  updated_at: string;
  eta_date?: string;
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    grand_total: number;
  };
  addresses: {
    billing: {
      name: string;
      line1: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    shipping: {
      name: string;
      line1: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  };
  shipping_method?: string;
  incoterms?: "EXW" | "FOB" | "DDP";
  shipments: Shipment[];
  documents: Document[];
  invoices: Invoice[];
  messages: Message[];
}

export interface Shipment {
  id: string;
  carrier: "UPS" | "FedEx" | "DHL" | "USPS" | "Other";
  service: "Ground" | "2Day" | "Overnight" | "Freight" | "Int'l";
  tracking_numbers: string[];
  status:
    | "Label_Created"
    | "In_Transit"
    | "Out_For_Delivery"
    | "Delivered"
    | "Exception";
  packages: Array<{
    weight_kg: number;
    dimensions_cm: [number, number, number];
  }>;
  events: TrackingEvent[];
  ship_date?: string;
  delivery_date?: string;
  docs: Document[];
}

export interface TrackingEvent {
  ts: string;
  location: string;
  status: string;
  description: string;
}

export interface Document {
  id: string;
  type:
    | "QAP"
    | "Certificate"
    | "FAIR"
    | "Measurement"
    | "Invoice"
    | "Receipt"
    | "CoC"
    | "MaterialCert"
    | "PDF";
  title: string;
  status: "Draft" | "Generating" | "Ready" | "Failed" | "Revoked";
  version: number;
  file_id: string;
  linked_type: "Quote" | "Order" | "Part" | "Organization";
  linked_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  checksum_sha256?: string;
  // Additional properties used in UI
  url?: string;
  name?: string;
  size?: number;
}

export interface File {
  id: string;
  name: string;
  mime: string;
  size_bytes: number;
  kind: "CAD" | "Drawing" | "PDF" | "Image" | "Zip" | "Other";
  owner_org_id: string;
  linked_type?: "Quote" | "Order" | "Part";
  linked_id?: string;
  preview_ready: boolean;
  created_at: string;
}

export interface QAPTemplate {
  id: string;
  name: string;
  process: "CNC" | "Sheet" | "Molding";
  revision: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  status: "Open" | "Paid" | "Refunded";
  amount: number;
  currency: string;
  created_at: string;
}

export interface Message {
  id: string;
  author: string;
  role: "buyer" | "support";
  body: string;
  attachments: Document[];
  created_at: string;
}

export interface OrderTimelineStep {
  name: string;
  ts?: string;
  actor?: string;
  note?: string;
}

export interface OrderFilters {
  status?: string[];
  date_range?: {
    from?: string;
    to?: string;
  };
  value?: string;
  source?: string;
  q?: string;
}

export interface OrdersListResponse {
  orders: Order[];
  total: number;
  page: number;
  page_size: number;
}

// Account & Organization Types
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  sso_providers: ("google" | "github" | "azuread")[];
  phone?: string;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  legal_name?: string;
  default_currency: "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD";
  default_units: "mm" | "in";
  itar_mode: boolean;
  onshore_only: boolean;
  tax_ids: TaxId[];
  addresses: Address[];
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  type: "billing" | "shipping";
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string; // ISO-3166-1 alpha-2
  is_default: boolean;
  validated: boolean;
  validation_error?: string;
  created_at: string;
  updated_at: string;
}

export interface TaxId {
  id: string;
  type: "VAT" | "EIN" | "GST" | "Other";
  value: string;
  country: string;
  verified: boolean;
  verification_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  user_id: string;
  org_id: string;
  role: "buyer" | "org_admin" | "reviewer" | "operator" | "finance";
  status: "active" | "invited" | "disabled";
  invited_at?: string;
  joined_at?: string;
  last_active_at?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface ApiToken {
  id: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string;
  prefix: string;
  created_by: string;
}

export interface EmailPref {
  id: string;
  user_id: string;
  org_id: string;
  events: {
    quote_sent: boolean;
    payment_succeeded: boolean;
    order_status_changed: boolean;
    weekly_digest: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface SavedTemplate {
  id: string;
  org_id: string;
  type: "material" | "finish" | "inspection";
  label: string;
  payload: any; // JSON payload based on template type
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

// RBAC Types
export type Permission =
  | "profile:read_write"
  | "addresses:read_write"
  | "email_prefs:read_write"
  | "templates:read_write"
  | "addresses:read"
  | "templates:read"
  | "tax:read_write"
  | "*";

export type Role = "buyer" | "org_admin" | "reviewer" | "operator" | "finance";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  buyer: [
    "profile:read_write",
    "addresses:read_write",
    "email_prefs:read_write",
    "templates:read_write",
  ],
  org_admin: ["*"],
  reviewer: [
    "templates:read_write",
    "addresses:read",
    "email_prefs:read_write",
  ],
  operator: ["addresses:read", "templates:read"],
  finance: ["addresses:read_write", "tax:read_write", "email_prefs:read_write"],
};

// Form Types
export interface ProfileFormData {
  name: string;
  phone?: string;
}

export interface OrganizationFormData {
  name: string;
  legal_name?: string;
  default_currency: Organization["default_currency"];
  default_units: Organization["default_units"];
  itar_mode: boolean;
  onshore_only: boolean;
}

export interface AddressFormData {
  type: Address["type"];
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface TaxIdFormData {
  type: TaxId["type"];
  value: string;
  country: string;
}

export interface InviteFormData {
  email: string;
  role: Member["role"];
}

export interface ApiTokenFormData {
  name: string;
  scopes: string[];
}

export interface TemplateFormData {
  type: SavedTemplate["type"];
  label: string;
  payload: any;
}

// API Response Types
export interface MembersListResponse {
  members: Member[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiTokensListResponse {
  tokens: ApiToken[];
  total: number;
  page: number;
  page_size: number;
}

export interface TemplatesListResponse {
  templates: SavedTemplate[];
  total: number;
  page: number;
  page_size: number;
}

// Help and Support Types
export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category:
    | "Getting Started"
    | "File Formats"
    | "Pricing Rules"
    | "DFM Guide"
    | "Payments"
    | "Orders"
    | "Privacy & Security";
  body_md: string;
  last_updated: string;
  related_ids: string[];
}

export interface SupportTicket {
  id: string;
  org_id: string | null;
  submitter_email: string;
  subject: string;
  severity: "Low" | "Normal" | "High" | "Critical";
  product_area:
    | "Instant Quote"
    | "CAD/DFM"
    | "Pricing"
    | "Checkout"
    | "Orders"
    | "Documents"
    | "Other";
  description_md: string;
  attachments: string[];
  status: "Open" | "Assigned" | "Awaiting Customer" | "Resolved" | "Closed";
  assignee_user_id: string | null;
  created_at: string;
}

export interface LeadCapture {
  id: string;
  email: string;
  source: "embed" | "web";
  utm: Record<string, any>;
  quote_id: string | null;
  verified: boolean;
  created_at: string;
}
