/**
 * Centralized Mock Data Store
 * Simulates real-time synchronization between Customer, Supplier, and Admin panels
 */

// ============ TYPES ============

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  created_at: string;
  status: 'active' | 'inactive';
  total_orders: number;
  total_spent: number;
}

export interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  supplier_id?: string;
  supplier_name?: string;
  status: 'draft' | 'quoted' | 'pending_approval' | 'approved' | 'in_production' | 'quality_check' | 'shipped' | 'delivered' | 'cancelled';
  total_value: number;
  parts_count: number;
  created_at: string;
  updated_at: string;
  due_date?: string;
  notes?: string;
  shipping_address: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  payment_status: 'pending' | 'partial' | 'paid';
}

export interface Part {
  id: string;
  order_id: string;
  name: string;
  file_name: string;
  file_url: string;
  material: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tolerance: string;
  finish: string;
  notes?: string;
  uploaded_at: string;
  status: 'pending' | 'quoted' | 'approved' | 'in_production' | 'completed';
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'customer' | 'supplier' | 'admin';
  recipient_id: string;
  recipient_name: string;
  recipient_role: 'customer' | 'supplier' | 'admin';
  subject: string;
  message: string;
  created_at: string;
  read: boolean;
  order_id?: string;
}

export interface Machine {
  id: string;
  supplier_id: string;
  name: string;
  type: 'cnc_mill' | 'cnc_lathe' | 'swiss_lathe' | '5_axis_mill' | 'edm' | 'grinding' | 'laser_cutting' | 'waterjet' | '3d_printer';
  manufacturer: string;
  model: string;
  year: number;
  status: 'operational' | 'maintenance' | 'down';
  capacity_hours_per_week: number;
  current_utilization: number;
  work_envelope: string;
  max_spindle_speed: string;
  tool_capacity: number;
  accuracy: string;
  created_at: string;
}

export interface SupplierCapability {
  id: string;
  supplier_id: string;
  category: 'material' | 'process' | 'finishing' | 'tolerance' | 'certification' | 'industry';
  name: string;
  description: string;
  verified: boolean;
  added_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  website?: string;
  rating: number;
  total_orders: number;
  completed_orders: number;
  active_orders: number;
  revenue: number;
  capacity_utilization: number;
  on_time_delivery: number;
  quality_score: number;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

// ============ MOCK DATA ============

let customers: Customer[] = [
  {
    id: 'CUST-001',
    name: 'John Smith',
    email: 'john.smith@techcorp.com',
    company: 'TechCorp Industries',
    phone: '(555) 123-4567',
    address: '123 Innovation Drive',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'USA',
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    total_orders: 45,
    total_spent: 125000
  },
  {
    id: 'CUST-002',
    name: 'Sarah Johnson',
    email: 'sarah.j@aerospace.com',
    company: 'Aerospace Dynamics',
    phone: '(555) 234-5678',
    address: '456 Flight Path',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
    country: 'USA',
    created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    total_orders: 78,
    total_spent: 340000
  },
  {
    id: 'CUST-003',
    name: 'Michael Chen',
    email: 'mchen@medicaldevices.com',
    company: 'Medical Devices Inc',
    phone: '(555) 345-6789',
    address: '789 Healthcare Blvd',
    city: 'Boston',
    state: 'MA',
    zip: '02101',
    country: 'USA',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    total_orders: 32,
    total_spent: 280000
  }
];

let orders: Order[] = [
  {
    id: 'ORD-2024-001',
    customer_id: 'CUST-001',
    customer_name: 'John Smith',
    customer_email: 'john.smith@techcorp.com',
    supplier_id: 'SUP-001',
    supplier_name: 'Precision Parts Co',
    status: 'in_production',
    total_value: 12500,
    parts_count: 5,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Rush order for prototype production',
    shipping_address: '123 Innovation Drive, San Francisco, CA 94105',
    priority: 'high',
    payment_status: 'partial'
  },
  {
    id: 'ORD-2024-002',
    customer_id: 'CUST-002',
    customer_name: 'Sarah Johnson',
    customer_email: 'sarah.j@aerospace.com',
    status: 'quoted',
    total_value: 45000,
    parts_count: 12,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Aerospace grade materials required, AS9100 certification needed',
    shipping_address: '456 Flight Path, Seattle, WA 98101',
    priority: 'urgent',
    payment_status: 'pending'
  },
  {
    id: 'ORD-2024-003',
    customer_id: 'CUST-003',
    customer_name: 'Michael Chen',
    customer_email: 'mchen@medicaldevices.com',
    supplier_id: 'SUP-005',
    supplier_name: 'Sterile Manufacturing',
    status: 'approved',
    total_value: 28000,
    parts_count: 8,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Medical grade, FDA compliant materials, cleanroom manufacturing required',
    shipping_address: '789 Healthcare Blvd, Boston, MA 02101',
    priority: 'high',
    payment_status: 'paid'
  }
];

let parts: Part[] = [
  {
    id: 'PART-001',
    order_id: 'ORD-2024-001',
    name: 'Housing Component',
    file_name: 'housing_v3.step',
    file_url: '/samples/cube.stl',
    material: 'Aluminum 6061-T6',
    quantity: 50,
    unit_price: 125,
    total_price: 6250,
    tolerance: '±0.005"',
    finish: 'Anodized Type II',
    notes: 'Black anodizing preferred',
    uploaded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'in_production'
  },
  {
    id: 'PART-002',
    order_id: 'ORD-2024-001',
    name: 'Mounting Bracket',
    file_name: 'bracket_assy.step',
    file_url: '/samples/cube.stl',
    material: 'Stainless Steel 304',
    quantity: 100,
    unit_price: 45,
    total_price: 4500,
    tolerance: '±0.010"',
    finish: 'Passivated',
    uploaded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'in_production'
  },
  {
    id: 'PART-003',
    order_id: 'ORD-2024-002',
    name: 'Titanium Wing Bracket',
    file_name: 'wing_bracket_main.step',
    file_url: '/samples/cube.stl',
    material: 'Titanium Ti-6Al-4V',
    quantity: 25,
    unit_price: 850,
    total_price: 21250,
    tolerance: '±0.002"',
    finish: 'Polished',
    notes: 'Aerospace grade, full material cert required',
    uploaded_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'quoted'
  }
];

const messages: Message[] = [
  {
    id: 'MSG-001',
    thread_id: 'THREAD-001',
    sender_id: 'CUST-001',
    sender_name: 'John Smith',
    sender_role: 'customer',
    recipient_id: 'ADMIN-001',
    recipient_name: 'Admin',
    recipient_role: 'admin',
    subject: 'Question about Order ORD-2024-001',
    message: 'Can we expedite the delivery? We need these parts 3 days earlier.',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
    order_id: 'ORD-2024-001'
  },
  {
    id: 'MSG-002',
    thread_id: 'THREAD-002',
    sender_id: 'SUP-001',
    sender_name: 'Precision Parts Co',
    sender_role: 'supplier',
    recipient_id: 'ADMIN-001',
    recipient_name: 'Admin',
    recipient_role: 'admin',
    subject: 'Machine Maintenance Update',
    message: 'Our 5-axis mill will be down for maintenance next week. Should we defer any orders?',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: true,
    order_id: undefined
  }
];

let machines: Machine[] = [
  {
    id: 'MACH-001',
    supplier_id: 'SUP-001',
    name: 'Haas VF-4',
    type: 'cnc_mill',
    manufacturer: 'Haas',
    model: 'VF-4',
    year: 2021,
    status: 'operational',
    capacity_hours_per_week: 120,
    current_utilization: 85,
    work_envelope: '50" x 20" x 25"',
    max_spindle_speed: '8100 RPM',
    tool_capacity: 24,
    accuracy: '±0.0005"',
    created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'MACH-002',
    supplier_id: 'SUP-001',
    name: 'DMG Mori NLX-2500',
    type: 'cnc_lathe',
    manufacturer: 'DMG Mori',
    model: 'NLX-2500',
    year: 2022,
    status: 'operational',
    capacity_hours_per_week: 140,
    current_utilization: 72,
    work_envelope: '10" dia x 20" length',
    max_spindle_speed: '5000 RPM',
    tool_capacity: 12,
    accuracy: '±0.0003"',
    created_at: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString()
  }
];

let supplierCapabilities: SupplierCapability[] = [
  {
    id: 'CAP-001',
    supplier_id: 'SUP-001',
    category: 'material',
    name: 'Aluminum 6061',
    description: 'Full capability for aluminum 6061 machining',
    verified: true,
    added_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'CAP-002',
    supplier_id: 'SUP-001',
    category: 'certification',
    name: 'ISO 9001:2015',
    description: 'Quality management system certification',
    verified: true,
    added_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'CAP-003',
    supplier_id: 'SUP-001',
    category: 'finishing',
    name: 'Anodizing Type II',
    description: 'In-house anodizing capabilities',
    verified: true,
    added_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()
  }
];

let suppliers: Supplier[] = [
  {
    id: 'SUP-001',
    name: 'Precision Parts Co',
    email: 'contact@precisionparts.com',
    phone: '(555) 111-2222',
    address: '100 Manufacturing Way',
    city: 'San Francisco',
    state: 'CA',
    zip: '94107',
    country: 'USA',
    website: 'www.precisionparts.com',
    rating: 4.8,
    total_orders: 245,
    completed_orders: 232,
    active_orders: 13,
    revenue: 1250000,
    capacity_utilization: 85,
    on_time_delivery: 94,
    quality_score: 96,
    status: 'active',
    created_at: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'SUP-002',
    name: 'Advanced CNC Solutions',
    email: 'info@advancedcnc.com',
    phone: '(555) 222-3333',
    address: '200 Tech Boulevard',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'USA',
    website: 'www.advancedcnc.com',
    rating: 4.9,
    total_orders: 312,
    completed_orders: 305,
    active_orders: 7,
    revenue: 1850000,
    capacity_utilization: 72,
    on_time_delivery: 97,
    quality_score: 98,
    status: 'active',
    created_at: new Date(Date.now() - 900 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// ============ CRUD OPERATIONS ============

// Customer Operations
export const getCustomers = () => [...customers];
export const getCustomer = (id: string) => customers.find(c => c.id === id);
export const createCustomer = (customer: Omit<Customer, 'id' | 'created_at' | 'total_orders' | 'total_spent'>) => {
  const newCustomer: Customer = {
    ...customer,
    id: `CUST-${String(customers.length + 1).padStart(3, '0')}`,
    created_at: new Date().toISOString(),
    total_orders: 0,
    total_spent: 0
  };
  customers.push(newCustomer);
  return newCustomer;
};
export const updateCustomer = (id: string, updates: Partial<Customer>) => {
  const index = customers.findIndex(c => c.id === id);
  if (index !== -1) {
    customers[index] = { ...customers[index], ...updates };
    return customers[index];
  }
  return null;
};
export const deleteCustomer = (id: string) => {
  customers = customers.filter(c => c.id !== id);
};

// Order Operations
export const getOrders = () => [...orders];
export const getOrder = (id: string) => orders.find(o => o.id === id);
export const getOrdersByCustomer = (customerId: string) => orders.filter(o => o.customer_id === customerId);
export const getOrdersBySupplier = (supplierId: string) => orders.filter(o => o.supplier_id === supplierId);
export const createOrder = (order: Omit<Order, 'id' | 'created_at' | 'updated_at'>) => {
  const newOrder: Order = {
    ...order,
    id: `ORD-2024-${String(orders.length + 1).padStart(3, '0')}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  orders.push(newOrder);
  return newOrder;
};
export const updateOrder = (id: string, updates: Partial<Order>) => {
  const index = orders.findIndex(o => o.id === id);
  if (index !== -1) {
    orders[index] = { ...orders[index], ...updates, updated_at: new Date().toISOString() };
    return orders[index];
  }
  return null;
};
export const deleteOrder = (id: string) => {
  orders = orders.filter(o => o.id !== id);
  parts = parts.filter(p => p.order_id !== id);
};

// Part Operations
export const getParts = () => [...parts];
export const getPart = (id: string) => parts.find(p => p.id === id);
export const getPartsByOrder = (orderId: string) => parts.filter(p => p.order_id === orderId);
export const createPart = (part: Omit<Part, 'id' | 'uploaded_at'>) => {
  const newPart: Part = {
    ...part,
    id: `PART-${String(parts.length + 1).padStart(3, '0')}`,
    uploaded_at: new Date().toISOString()
  };
  parts.push(newPart);
  return newPart;
};
export const updatePart = (id: string, updates: Partial<Part>) => {
  const index = parts.findIndex(p => p.id === id);
  if (index !== -1) {
    parts[index] = { ...parts[index], ...updates };
    return parts[index];
  }
  return null;
};
export const deletePart = (id: string) => {
  parts = parts.filter(p => p.id !== id);
};

// Message Operations
export const getMessages = () => [...messages];
export const getMessage = (id: string) => messages.find(m => m.id === id);
export const getMessagesByThread = (threadId: string) => messages.filter(m => m.thread_id === threadId);
export const getMessagesByRole = (role: 'customer' | 'supplier' | 'admin', userId: string) => 
  messages.filter(m => (m.sender_id === userId && m.sender_role === role) || (m.recipient_id === userId && m.recipient_role === role));
export const createMessage = (message: Omit<Message, 'id' | 'created_at'>) => {
  const newMessage: Message = {
    ...message,
    id: `MSG-${String(messages.length + 1).padStart(3, '0')}`,
    created_at: new Date().toISOString()
  };
  messages.push(newMessage);
  return newMessage;
};
export const markMessageAsRead = (id: string) => {
  const index = messages.findIndex(m => m.id === id);
  if (index !== -1) {
    messages[index].read = true;
    return messages[index];
  }
  return null;
};

// Machine Operations
export const getMachines = () => [...machines];
export const getMachine = (id: string) => machines.find(m => m.id === id);
export const getMachinesBySupplier = (supplierId: string) => machines.filter(m => m.supplier_id === supplierId);
export const createMachine = (machine: Omit<Machine, 'id' | 'created_at'>) => {
  const newMachine: Machine = {
    ...machine,
    id: `MACH-${String(machines.length + 1).padStart(3, '0')}`,
    created_at: new Date().toISOString()
  };
  machines.push(newMachine);
  return newMachine;
};
export const updateMachine = (id: string, updates: Partial<Machine>) => {
  const index = machines.findIndex(m => m.id === id);
  if (index !== -1) {
    machines[index] = { ...machines[index], ...updates };
    return machines[index];
  }
  return null;
};
export const deleteMachine = (id: string) => {
  machines = machines.filter(m => m.id !== id);
};

// Supplier Capability Operations
export const getCapabilities = () => [...supplierCapabilities];
export const getCapability = (id: string) => supplierCapabilities.find(c => c.id === id);
export const getCapabilitiesBySupplier = (supplierId: string) => supplierCapabilities.filter(c => c.supplier_id === supplierId);
export const createCapability = (capability: Omit<SupplierCapability, 'id' | 'added_at'>) => {
  const newCapability: SupplierCapability = {
    ...capability,
    id: `CAP-${String(supplierCapabilities.length + 1).padStart(3, '0')}`,
    added_at: new Date().toISOString()
  };
  supplierCapabilities.push(newCapability);
  return newCapability;
};
export const updateCapability = (id: string, updates: Partial<SupplierCapability>) => {
  const index = supplierCapabilities.findIndex(c => c.id === id);
  if (index !== -1) {
    supplierCapabilities[index] = { ...supplierCapabilities[index], ...updates };
    return supplierCapabilities[index];
  }
  return null;
};
export const deleteCapability = (id: string) => {
  supplierCapabilities = supplierCapabilities.filter(c => c.id !== id);
};

// Supplier Operations
export const getSuppliers = () => [...suppliers];
export const getSupplier = (id: string) => suppliers.find(s => s.id === id);
export const createSupplier = (supplier: Omit<Supplier, 'id' | 'created_at' | 'total_orders' | 'completed_orders' | 'active_orders' | 'revenue'>) => {
  const newSupplier: Supplier = {
    ...supplier,
    id: `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
    created_at: new Date().toISOString(),
    total_orders: 0,
    completed_orders: 0,
    active_orders: 0,
    revenue: 0
  };
  suppliers.push(newSupplier);
  return newSupplier;
};
export const updateSupplier = (id: string, updates: Partial<Supplier>) => {
  const index = suppliers.findIndex(s => s.id === id);
  if (index !== -1) {
    suppliers[index] = { ...suppliers[index], ...updates };
    return suppliers[index];
  }
  return null;
};
export const deleteSupplier = (id: string) => {
  suppliers = suppliers.filter(s => s.id !== id);
  machines = machines.filter(m => m.supplier_id !== id);
  supplierCapabilities = supplierCapabilities.filter(c => c.supplier_id !== id);
};

// Helper: Get unread message count
export const getUnreadMessageCount = (role: 'customer' | 'supplier' | 'admin', userId: string) => {
  return messages.filter(m => m.recipient_id === userId && m.recipient_role === role && !m.read).length;
};

// Helper: Assign supplier to order
export const assignSupplierToOrder = (orderId: string, supplierId: string) => {
  const supplier = getSupplier(supplierId);
  if (!supplier) return null;
  
  return updateOrder(orderId, {
    supplier_id: supplierId,
    supplier_name: supplier.name,
    status: 'approved'
  });
};
