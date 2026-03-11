CREATE TABLE order_status_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL REFERENCES orders(id),

    supplier_id UUID NOT NULL REFERENCES organizations(id),

    status_to TEXT NOT NULL,

    comments TEXT,

    approved_by UUID NOT NULL REFERENCES user(id),

    reviwed_at TIMESTAMPTZ,

    rejection_reason TEXT,

    status TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oscr_order_id 
ON order_status_change_requests(order_id);

CREATE INDEX idx_oscr_supplier_id 
ON order_status_change_requests(supplier_id);

CREATE INDEX idx_oscr_status 
ON order_status_change_requests(status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_order_status_change_requests_updated_at
BEFORE UPDATE
ON order_status_change_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();