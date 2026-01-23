CREATE OR REPLACE FUNCTION create_manual_quotes(
        p_user_id UUID,
        p_parts JSONB,
        p_meta JSONB
    ) RETURNS TABLE(out_rfq_id UUID, out_rfq_code TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rfq_id UUID;
v_rfq_code TEXT;
v_organization_id UUID;
BEGIN -- 1. Get Organization ID
SELECT organization_id INTO v_organization_id
FROM users
WHERE id = p_user_id;
IF v_organization_id IS NULL THEN RAISE EXCEPTION 'User % has no organization',
p_user_id;
END IF;
-- 2. Create the RFQ
INSERT INTO rfq (
        user_id,
        organization_id,
        status,
        rfq_type,
        manual_quote_metadata
    )
VALUES (
        p_user_id,
        v_organization_id,
        'pending approval',
        'manual',
        p_meta
    )
RETURNING id,
    rfq_code INTO v_rfq_id,
    v_rfq_code;
-- 3. Bulk Operations using chained CTEs
WITH part_ids AS (
    SELECT value::UUID as id
    FROM jsonb_array_elements_text(p_parts)
),
update_parts AS (
    UPDATE rfq_parts
    SET rfq_id = v_rfq_id
    FROM part_ids
    WHERE rfq_parts.id = part_ids.id
)
INSERT INTO manual_quote_approval (rfq_id, rfq_part_id)
SELECT v_rfq_id,
    id
FROM part_ids;
-- 4. Return the new RFQ details
RETURN QUERY
SELECT v_rfq_id,
    v_rfq_code;
END;
$$;