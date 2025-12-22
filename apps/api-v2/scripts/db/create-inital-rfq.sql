CREATE OR REPLACE FUNCTION create_initial_rfq(p_user_id UUID, p_parts JSONB) RETURNS TABLE (out_rfq_id UUID, out_rfq_code TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rfq_id UUID;
v_rfq_code TEXT;
part JSONB;
BEGIN -- Create RFQ in draft state
INSERT INTO rfq (user_id, status)
VALUES (p_user_id, 'draft')
RETURNING id,
    rfq_code INTO v_rfq_id,
    v_rfq_code;
-- Create RFQ parts
FOR part IN
SELECT *
FROM jsonb_array_elements(p_parts) LOOP
INSERT INTO rfq_parts (
        rfq_id,
        status,
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
        geometry
    )
VALUES (
        v_rfq_id,
        'draft',
        part->>'file_name',
        part->>'cad_file_url',
        part->>'cad_file_type',
        part->>'material',
        (part->>'quantity')::INT,
        part->>'tolerance',
        part->>'finish',
        part->>'threads',
        part->>'inspection',
        part->>'notes',
        part->>'lead_time_type',
        (part->>'lead_time')::INT,
        part->'geometry'
    );
END LOOP;
RETURN QUERY
SELECT v_rfq_id,
    v_rfq_code;
END;
$$;