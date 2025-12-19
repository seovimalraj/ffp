CREATE OR REPLACE FUNCTION abandon_rfq_part(
        p_part_id UUID,
        p_user_id UUID,
        p_reason TEXT
    ) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_abandoned_part_id UUID := gen_random_uuid();
BEGIN -- Ensure part exists
IF NOT EXISTS (
    SELECT 1
    FROM rfq_parts
    WHERE id = p_part_id
) THEN RAISE EXCEPTION 'RFQ part % does not exist',
p_part_id;
END IF;
-- Move rfq_part to abandoned_rfq_parts
INSERT INTO abandoned_rfq_parts (
        id,
        rfq_id,
        original_part_id,
        file_name,
        cad_file_url,
        cad_file_type,
        material,
        quantity,
        tolerance,
        finish,
        threads,
        inspection,
        notes,
        lead_time_type,
        lead_time,
        delivery_date,
        geometry,
        pricing,
        final_price,
        created_at,
        updated_at,
        abandoned_reason,
        abandoned_by,
        abandoned_at
    )
SELECT v_abandoned_part_id,
    rfq_id,
    id,
    file_name,
    cad_file_url,
    cad_file_type,
    material,
    quantity,
    tolerance,
    finish,
    threads,
    inspection,
    notes,
    lead_time_type,
    lead_time,
    delivery_date,
    geometry,
    pricing,
    final_price,
    created_at,
    updated_at,
    p_reason,
    p_user_id,
    CURRENT_TIMESTAMP
FROM rfq_parts
WHERE id = p_part_id;
-- Move 2D drawings
INSERT INTO abandoned_part_drawing_2d (
        abandoned_part_id,
        file_name,
        file_url,
        mime_type,
        created_at,
        updated_at
    )
SELECT v_abandoned_part_id,
    file_name,
    file_url,
    mime_type,
    created_at,
    updated_at
FROM part_drawing_2d
WHERE rfq_part_id = p_part_id;
-- Delete original drawings
DELETE FROM part_drawing_2d
WHERE rfq_part_id = p_part_id;
-- Delete original part
DELETE FROM rfq_parts
WHERE id = p_part_id;
END;
$$;