CREATE OR REPLACE FUNCTION create_initial_rfq(
    p_user_id UUID,
    p_parts JSONB
)
RETURNS TABLE (
    out_rfq_id UUID,
    out_rfq_code TEXT,
    out_part_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rfq_id UUID;
    v_rfq_code TEXT;
    v_organization_id UUID;
    v_part_id UUID;
    v_part_ids UUID[] := '{}';
    part JSONB;
BEGIN
    -- Resolve organization from user
    SELECT organization_id
    INTO v_organization_id
    FROM users
    WHERE id = p_user_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'User % has no organization', p_user_id;
    END IF;

    -- Create RFQ
    INSERT INTO rfq (user_id, organization_id, status)
    VALUES (p_user_id, v_organization_id, 'draft')
    RETURNING id, rfq_code
    INTO v_rfq_id, v_rfq_code;

    -- Insert parts
    FOR part IN
        SELECT * FROM jsonb_array_elements(p_parts)
    LOOP
        INSERT INTO rfq_parts (
            rfq_id,
            organization_id,
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
            geometry,
            sheet_thickness_mm,
            thickness,
            process
        )
        VALUES (
            v_rfq_id,
            v_organization_id,
            COALESCE(part->>'status', 'queued'),
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
            part->'geometry',
            CASE
                WHEN part->>'process' = 'sheet-metal'
                THEN NULLIF(part->>'sheet_thickness_mm', '')::NUMERIC
                ELSE NULL
            END,
            CASE
                WHEN part->>'process' = 'sheet-metal'
                THEN NULLIF(part->>'thickness', '')::NUMERIC
                ELSE NULL
            END,
            part->>'process'
        )
        RETURNING id INTO v_part_id;

        -- Collect IDs
        v_part_ids := array_append(v_part_ids, v_part_id);
    END LOOP;

    RETURN QUERY
    SELECT v_rfq_id, v_rfq_code, v_part_ids;
END;
$$;