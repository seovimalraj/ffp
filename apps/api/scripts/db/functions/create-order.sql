CREATE TYPE order_part_input AS (
  rfq_part_id UUID,
  part_name TEXT,
  quantity INTEGER,
  unit_price NUMERIC(12, 2),
  lead_time SMALLINT,
  lead_time_type TEXT
);
CREATE OR REPLACE FUNCTION create_order (
    p_organization_id UUID,
    p_created_by UUID,
    p_rfq_id UUID,
    p_parts order_part_input [],
    p_subtotal NUMERIC(12, 2),
    p_shipping_cost NUMERIC(12, 2),
    p_tax_amount NUMERIC(12, 2),
    p_customs_info JSONB DEFAULT NULL,
    p_shipping_method TEXT DEFAULT NULL,
    p_internal_notes TEXT DEFAULT NULL,
    p_shipping_information JSONB DEFAULT NULL,
    p_address_snapshot JSONB DEFAULT NULL
  ) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_order_id UUID;
v_order_code TEXT;
v_part order_part_input;
v_part_id UUID;
v_total NUMERIC(12, 2);
BEGIN -------------------------------------------------------------------
-- 1. If an order already exists for this RFQ, return it (ignore)
-------------------------------------------------------------------
SELECT id INTO v_order_id
FROM orders
WHERE rfq_id = p_rfq_id
LIMIT 1;
IF v_order_id IS NOT NULL THEN RETURN v_order_id;
END IF;
-------------------------------------------------------------------
-- 2. Calculate total
-------------------------------------------------------------------
v_total := p_subtotal + p_shipping_cost + p_tax_amount;
-------------------------------------------------------------------
-- 3. Generate order code
-------------------------------------------------------------------
v_order_code := generate_order_code();
-------------------------------------------------------------------
-- 4. Create order
-------------------------------------------------------------------
INSERT INTO orders (
    order_code,
    organization_id,
    created_by,
    rfq_id,
    subtotal,
    shipping_cost,
    tax_amount,
    total_amount,
    customs_info,
    internal_notes,
    address_snapshot,
    status,
    payment_status
  )
VALUES (
    v_order_code,
    p_organization_id,
    p_created_by,
    p_rfq_id,
    p_subtotal,
    p_shipping_cost,
    p_tax_amount,
    v_total,
    p_customs_info,
    p_internal_notes,
    p_address_snapshot,
    'payment pending',
    'pending'
  )
RETURNING id INTO v_order_id;
-------------------------------------------------------------------
-- 5. Create order parts + history
-------------------------------------------------------------------
FOREACH v_part IN ARRAY p_parts LOOP
INSERT INTO order_parts (
    order_id,
    rfq_part_id,
    part_name,
    quantity,
    unit_price,
    total_price,
    status,
    status_changed_at,
    lead_time,
    lead_time_type
  )
VALUES (
    v_order_id,
    v_part.rfq_part_id,
    v_part.part_name,
    v_part.quantity,
    v_part.unit_price,
    v_part.quantity * v_part.unit_price,
    'payment pending',
    now(),
    v_part.lead_time,
    v_part.lead_time_type
  )
RETURNING id INTO v_part_id;
INSERT INTO order_part_status_history (
    order_part_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
VALUES (
    v_part_id,
    NULL,
    'payment pending',
    p_created_by,
    'Order created'
  );
END LOOP;
-------------------------------------------------------------------
-- 6. Create shipping (once per order)
-------------------------------------------------------------------
INSERT INTO order_shipping (
    order_id,
    address_snapshot,
    shipping_method,
    shipping_information
  )
VALUES (
    v_order_id,
    p_address_snapshot,
    p_shipping_method,
    p_shipping_information
  );
-------------------------------------------------------------------
-- 7. Update RFQ (safe)
-------------------------------------------------------------------
UPDATE rfq
SET order_id = v_order_id,
  status = 'payment pending',
  updated_at = now()
WHERE id = p_rfq_id
  AND order_id IS NULL;
RETURN v_order_id;
END;
$$;