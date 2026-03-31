-- 1. Order Workflow Templates
CREATE TABLE IF NOT EXISTS order_workflow_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    phases JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase Object
-- {
--     id: uuid,
--     label: string,
--     key: string,
--     order: number,
--     include: string[],
--     color: string
-- }

-- Template Indexes
CREATE INDEX IF NOT EXISTS otw_name_idx ON order_workflow_templates(name);
CREATE INDEX IF NOT EXISTS otw_mfg_type_idx ON order_workflow_templates(manufacturing_type);

-- Partial Index: Only index active templates (saves space/time)
CREATE INDEX IF NOT EXISTS otw_active_idx ON order_workflow_templates(is_active) WHERE is_active = true;

-- 2. Order Workflow Instance
CREATE TABLE IF NOT EXISTS order_workflow_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id),
    order_workflow_id uuid NOT NULL REFERENCES order_workflow_templates(id),
    phase_snapshot JSONB NOT NULL,
    assigned_by uuid NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Instance Indexes
CREATE INDEX IF NOT EXISTS owi_order_id_idx ON order_workflow_instances(order_id);
CREATE INDEX IF NOT EXISTS owi_workflow_id_idx ON order_workflow_instances(order_workflow_id);

-- GIN Index: Allows you to search INSIDE the phase_snapshot JSON
CREATE INDEX IF NOT EXISTS owi_phase_snapshot_gin_idx ON order_workflow_instances USING GIN (phase_snapshot);

CREATE OR REPLACE FUNCTION update_modified_ort_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_otw_modtime 
BEFORE UPDATE ON order_workflow_templates 
FOR EACH ROW EXECUTE PROCEDURE update_modified_ort_column();