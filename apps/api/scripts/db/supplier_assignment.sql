CREATE TABLE supplier_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    assigned_to UUID NOT NULL
        REFERENCES organizations(id),

    assigned_by UUID NOT NULL
        REFERENCES users(id),

    current_status TEXT NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT supplier_assignments_status_check
        CHECK (current_status <> '')
);

CREATE INDEX idx_supplier_assignments_order
ON supplier_assignments(order_id);

CREATE INDEX idx_supplier_assignments_supplier_status
ON supplier_assignments(assigned_to, current_status);

CREATE INDEX idx_supplier_assignments_assigned_by_time
ON supplier_assignments(assigned_by, assigned_at DESC); 

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_assignments_updated
BEFORE UPDATE ON supplier_assignments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

