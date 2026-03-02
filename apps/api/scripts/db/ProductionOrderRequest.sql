CREATE SEQUENCE production_order_request_seq;

CREATE TABLE production_order_request (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    code text NOT NULL UNIQUE
        DEFAULT 'FRI_PRO_REQ_' || lpad(nextval('production_order_request_seq')::text, 5, '0'),

    project_name text NOT NULL DEFAULT '',

    organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,

    manufacturing_services text[],

    project_description text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER SEQUENCE production_order_request_seq
OWNED BY production_order_request.code;