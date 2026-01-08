CREATE OR REPLACE FUNCTION mark_order_payment_failed(
        p_order_id UUID,
        p_reason TEXT DEFAULT 'Payment failed'
    ) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_rfq_id UUID;
BEGIN -- Lock the order row
SELECT rfq_id INTO v_rfq_id
FROM orders
WHERE id = p_order_id FOR
UPDATE;
-- Order already gone or never existed
IF v_rfq_id IS NULL THEN RETURN;
END IF;
------------------------------------------------------------------
-- Restore RFQ
------------------------------------------------------------------
UPDATE rfq
SET order_id = NULL,
    status = 'submitted',
    -- or 'open' / 'created'
    updated_at = now()
WHERE id = v_rfq_id;
------------------------------------------------------------------
-- Delete the order (CASCADE handles everything else)
------------------------------------------------------------------
DELETE FROM orders
WHERE id = p_order_id;
END;
$$;