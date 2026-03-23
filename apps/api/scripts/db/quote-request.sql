CREATE TYPE quote_request_status_type AS ENUM (
    'requested',
    'accepted',
    'declined',
    'cancelled'
);

CREATE TABLE quote_request (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id uuid NOT NULL REFERENCES orders(id),
    supplier_id uuid NOT NULL REFERENCES organizations(id),
    contact_user uuid NOT NULL REFERENCES users(id),

    status quote_request_status_type DEFAULT 'requested',

    notes text,

    cancelled_at TIMESTAMPTZ,
    cancel_reason text 

    responded_at TIMESTAMPTZ,
    reject_reason text DEFAULT '',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

alter table quote_request
add CONSTRAINT check_cancel_time
check (
    (status != 'cancelled' AND cancelled_at is null)
    or 
    (status = 'cancelled' AND  cancelled_at is not null)
)

CREATE INDEX quote_request_order_idx ON quote_request(order_id);
CREATE INDEX quote_request_supplier_idx ON quote_request(supplier_id);
CREATE INDEX quote_request_status_idx ON quote_request(status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quote_request_updated_at
BEFORE UPDATE ON quote_request
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- 
-- -- 
-- -- Quote Request events
-- -- 
--

CREATE TYPE quote_request_event_type AS ENUM (
    'created',
    'sent_to_supplier',
    'accepted',
    'declined',
    'reminded',
    'cancelled'
);

CREATE TABLE quote_request_event (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    quote_request_id uuid not null
        references qutoe_request(id) on delete cascade,
    
    event_type quote_request_event_type not null,

    actor_id uuid,

    metadata jsonb default '{}',

    created_at TIMESTAMPTZ default now()
)

CREATE INDEX quote_request_event_qr_idx 
ON quote_request_event(quote_request_id);

CREATE INDEX quote_request_event_type_idx 
ON quote_request_event(event_type);

CREATE INDEX quote_request_event_created_idx 
ON quote_request_event(created_at DESC);