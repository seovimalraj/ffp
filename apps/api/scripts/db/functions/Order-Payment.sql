--
-- -- Payment Paid Function
--
CREATE OR REPLACE FUNCTION mark_order_paid(
        p_order_id UUID,
        p_payment_gateway TEXT,
        p_transaction_id TEXT,
        p_amount_captured NUMERIC(12, 2),
        p_billing_snapshot JSONB DEFAULT NULL
    ) RETURNS VOID AS $$
DECLARE v_existing_status TEXT;
BEGIN -- Lock order row
SELECT payment_status INTO v_existing_status
FROM orders
WHERE id = p_order_id FOR
UPDATE;
IF v_existing_status IS NULL THEN RAISE EXCEPTION 'Order % not found',
p_order_id;
END IF;
-- Idempotent: already paid
IF v_existing_status = 'paid' THEN RETURN;
END IF;
-- Insert or update payment
INSERT INTO order_payments (
        order_id,
        payment_type,
        payment_gateway,
        transaction_id,
        amount_captured,
        billing_snapshot,
        status
    )
VALUES (
        p_order_id,
        'online',
        p_payment_gateway,
        p_transaction_id,
        p_amount_captured,
        p_billing_snapshot,
        'captured'
    ) ON CONFLICT (transaction_id) DO
UPDATE
SET amount_captured = EXCLUDED.amount_captured,
    status = 'captured';
-- Update order
UPDATE orders
SET payment_status = 'paid',
    status = 'paid',
    confirmed_at = now(),
    updated_at = now()
WHERE id = p_order_id;
-- Update RFQ
UPDATE rfq
SET status = 'paid',
    updated_at = now()
WHERE id = (
        SELECT rfq_id
        FROM orders
        WHERE id = p_order_id
    );
END;
$$ LANGUAGE plpgsql;
-- 
-- -- Payment Confirmation Triggers Function
-- 
CREATE OR REPLACE FUNCTION create_part_confirmations_on_paid() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_part RECORD;
BEGIN -- Only pending → paid
IF OLD.status = 'payment pending'
AND NEW.status = 'paid' THEN -- Move parts to backlog
UPDATE order_parts
SET status = 'backlog',
    updated_at = now()
WHERE order_id = NEW.id;
-- Capture status history for audited parts
INSERT INTO order_part_status_history (
        order_part_id,
        from_status,
        to_status,
        reason
    )
SELECT id,
    'payment pending',
    'backlog',
    'Payment confirmed'
FROM order_parts
WHERE order_id = NEW.id;
-- Create confirmations per part
FOR v_part IN
SELECT id
FROM order_parts
WHERE order_id = NEW.id LOOP -- Pricing confirmed
INSERT INTO order_part_confirmations (
        order_part_id,
        order_id,
        confirmation_type,
        status,
        is_active,
        confirmed_at
    )
VALUES (
        v_part.id,
        NEW.id,
        'pricing',
        'confirmed',
        TRUE,
        now()
    ) ON CONFLICT (order_part_id, confirmation_type) DO NOTHING;
-- Execution confirmations (pending)
INSERT INTO order_part_confirmations (
        order_part_id,
        order_id,
        confirmation_type,
        status,
        is_active
    )
SELECT v_part.id,
    NEW.id,
    ct,
    'pending',
    TRUE
FROM unnest(
        ARRAY [
          'material'::confirmation_type,
          'delivery_date'::confirmation_type,
          'inspection'::confirmation_type,
          'delivery'::confirmation_type
        ]
    ) AS ct ON CONFLICT (order_part_id, confirmation_type) DO NOTHING;
END LOOP;
END IF;
RETURN NEW;
END;
$$;
-- 
-- -- Triggers
-- 
DROP TRIGGER IF EXISTS trg_create_part_confirmations_on_paid ON orders;
CREATE TRIGGER trg_create_part_confirmations_on_paid
AFTER
UPDATE OF payment_status ON orders FOR EACH ROW EXECUTE FUNCTION create_part_confirmations_on_paid();