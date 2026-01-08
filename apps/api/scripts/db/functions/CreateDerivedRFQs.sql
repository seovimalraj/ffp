CREATE OR REPLACE FUNCTION create_derived_rfqs(p_user_id UUID, p_groups UUID [] []) RETURNS TABLE (rfq_id UUID, rfq_code TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_org_id UUID;
v_rfq_id UUID;
v_rfq_code TEXT;
v_group UUID [];
BEGIN -- Resolve organization once
SELECT organization_id INTO v_org_id
FROM users
WHERE id = p_user_id;
IF v_org_id IS NULL THEN RAISE EXCEPTION 'User % has no organization',
p_user_id;
END IF;
-- Loop groups
FOREACH v_group SLICE 1 IN ARRAY p_groups LOOP -- Create RFQ
INSERT INTO rfq (user_id, organization_id, status)
VALUES (p_user_id, v_org_id, 'draft')
RETURNING id,
    rfq_code INTO v_rfq_id,
    v_rfq_code;
-- Insert parts directly from existing rfq_parts
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
        geometry
    )
SELECT v_rfq_id,
    v_org_id,
    'draft',
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
FROM rfq_parts
WHERE id = ANY(v_group)
    AND organization_id = v_org_id;
-- Safety check
IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or cross-org parts detected';
END IF;
rfq_id := v_rfq_id;
rfq_code := v_rfq_code;
RETURN NEXT;
END LOOP;
END;
$$;