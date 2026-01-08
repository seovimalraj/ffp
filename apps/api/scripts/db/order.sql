CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES users(id),
  rfq_id UUID REFERENCES rfq(id),
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12, 2) NOT NULL,
  shipping_cost NUMERIC(12, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL,
  estimated_ship_date TIMESTAMP,
  estimated_delivery_date TIMESTAMP,
  actual_ship_date TIMESTAMP,
  actual_delivery_date TIMESTAMP,
  customs_info JSONB,
  address_snapshot JSONB,
  part_type TEXT,
  industry TEXT,
  internal_notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  confirmed_at TIMESTAMP
);
CREATE INDEX idx_orders_org_id ON orders(organization_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_code ON orders(order_code);
--
-- -- Order Sequence
--
CREATE SEQUENCE order_code_seq START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
--
-- -- Order Trigger
--
CREATE OR REPLACE FUNCTION generate_order_code() RETURNS TEXT AS $$
DECLARE v_seq BIGINT;
BEGIN v_seq := nextval('order_code_seq');
RETURN 'FRI_ORD_' || LPAD(v_seq::TEXT, 8, '0');
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION set_order_code() RETURNS TRIGGER AS $$ BEGIN IF NEW.order_code IS NULL THEN NEW.order_code := generate_order_code();
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--
-- -- Order Parts
--
CREATE TABLE order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_code TEXT,
  part_code TEXT UNIQUE,
  rfq_part_id UUID NOT NULL REFERENCES rfq_parts(id),
  part_name TEXT,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  status_changed_at TIMESTAMP DEFAULT now(),
  lead_time Int8,
  lead_time_type TEXT,
  unit_price NUMERIC(12, 2),
  total_price NUMERIC(12, 2),
  estimated_ship_date TIMESTAMP,
  actual_ship_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (order_id, rfq_part_id)
);
CREATE INDEX idx_order_parts_order_id ON order_parts(order_id);
CREATE INDEX idx_order_parts_status ON order_parts(status);
CREATE INDEX idx_order_parts_status_changed_at ON order_parts(status_changed_at DESC);
--
-- -- Order part sequence
--
CREATE SEQUENCE order_part_code_seq START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;
CREATE OR REPLACE FUNCTION set_order_part_code() RETURNS TRIGGER AS $$ BEGIN IF NEW.part_code IS NULL THEN NEW.part_code := 'FRI_OP_' || LPAD(nextval('order_part_code_seq')::TEXT, 8, '0');
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 
-- -- Order part trigger
--
CREATE TRIGGER trg_set_order_part_code BEFORE
INSERT ON order_parts FOR EACH ROW EXECUTE FUNCTION set_order_part_code();
--
-- --
--
CREATE TABLE order_part_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_part_id UUID NOT NULL REFERENCES order_parts(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_opsh_part_id ON order_part_status_history(order_part_id);
CREATE INDEX idx_opsh_created_at ON order_part_status_history(created_at DESC);
CREATE TABLE shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  street1 TEXT NOT NULL,
  street2 TEXT,
  city TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_shipping_addresses_org_id ON shipping_addresses(organization_id);
CREATE TABLE order_shipping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  address_snapshot JSONB NOT NULL,
  shipping_method TEXT NOT NULL,
  carrier TEXT,
  service_level TEXT,
  tracking_number TEXT,
  shipping_information JSONB,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_order_shipping_order_id ON order_shipping(order_id);
CREATE INDEX idx_order_shipping_tracking ON order_shipping(tracking_number);
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL,
  -- invoice, card, wire
  payment_gateway TEXT,
  transaction_id TEXT UNIQUE,
  amount_authorized NUMERIC(12, 2),
  amount_captured NUMERIC(12, 2),
  amount_refunded NUMERIC(12, 2) DEFAULT 0,
  billing_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX idx_order_payments_status ON order_payments(status);
CREATE TABLE organization_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  agreement_type TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX idx_org_agreements_org_id ON organization_agreements(organization_id);
CREATE INDEX idx_org_agreements_type ON organization_agreements(agreement_type);
CREATE TYPE confirmation_type AS ENUM (
  'material',
  'pricing',
  'drawing_2d',
  'delivery_date',
  'inspection',
  'delivery'
);
CREATE TYPE confirmation_status AS ENUM ('pending', 'confirmed', 'rejected');
CREATE TABLE order_part_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_part_id UUID NOT NULL REFERENCES order_parts(id) ON DELETE CASCADE,
  order_id uuid not null references orders(id) on delete cascade,
  confirmation_type confirmation_type NOT NULL,
  status confirmation_status NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMP,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (order_part_id, confirmation_type)
);
part_id,
confirmation_type
)
);