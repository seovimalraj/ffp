CREATE TABLE warehouses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,

    organization_id uuid NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,

    total_capacity numeric(14,3) NOT NULL CHECK (total_capacity >= 0),
    used_capacity numeric(14,3) NOT NULL DEFAULT 0 CHECK (used_capacity >= 0),
    CHECK (used_capacity <= total_capacity),

    geolocation text,
    address text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (organization_id, name)
);



CREATE TABLE supplier_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    material_id uuid NOT NULL REFERENCES general_materials(id) ON DELETE CASCADE,
    warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    
    stock_unit unit_type NOT NULL,                     -- kg, piece, etc.
    supplier_price numeric(14,2),                     -- supplier-specific price
    currency currency_type NOT NULL DEFAULT 'USD',
    current_stock int NOT NULL DEFAULT 0,
    max_stock int NOT NULL DEFAULT 0,
    status material_status NOT NULL DEFAULT 'active',
    
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE (supplier_id, material_id, warehouse_id)  -- one row per supplier-material-warehouse
);

CREATE INDEX idx_supplier_materials_material ON supplier_materials(material_id);
CREATE INDEX idx_supplier_materials_warehouse ON supplier_materials(warehouse_id);
CREATE INDEX idx_supplier_materials_supplier ON supplier_materials(supplier_id);
