CREATE OR REPLACE FUNCTION get_rfq_parts_infinite(
        p_organization_id UUID,
        p_status TEXT DEFAULT NULL,
        p_rfq_limit INTEGER DEFAULT 10,
        p_cursor_created_at TIMESTAMP DEFAULT NULL,
        p_cursor_rfq_id UUID DEFAULT NULL
    ) RETURNS TABLE (
        id UUID,
        rfq_id UUID,
        file_name VARCHAR,
        cad_file_url VARCHAR,
        cad_file_type VARCHAR,
        snapshot_2d_url TEXT,
        status VARCHAR,
        material VARCHAR,
        quantity INT,
        lead_time INT,
        lead_time_type VARCHAR,
        final_price NUMERIC,
        created_at TIMESTAMP,
        rfq_created_at TIMESTAMP,
        rfq JSONB,
        part_drawing_2d JSONB
    ) LANGUAGE sql SECURITY DEFINER AS $$ WITH rfq_page AS (
        SELECT r.id,
            r.rfq_code,
            r.status,
            r.created_at
        FROM rfq r
        WHERE r.organization_id = p_organization_id
            AND (
                p_status IS NULL
                OR r.status = p_status
            )
            AND (
                p_cursor_created_at IS NULL
                OR (r.created_at, r.id) < (p_cursor_created_at, p_cursor_rfq_id)
            )
        ORDER BY r.created_at DESC,
            r.id DESC
        LIMIT p_rfq_limit
    )
SELECT rp.id,
    rp.rfq_id,
    rp.file_name,
    rp.cad_file_url,
    rp.cad_file_type,
    rp.snapshot_2d_url,
    rp.status,
    rp.material,
    rp.quantity,
    rp.lead_time,
    rp.lead_time_type,
    rp.final_price,
    rp.created_at,
    r.created_at AS rfq_created_at,
    -- Nested RFQ object (matches frontend type)
    jsonb_build_object(
        'id',
        r.id,
        'rfq_code',
        r.rfq_code,
        'status',
        r.status
    ) AS rfq,
    -- Explicitly ignored
    NULL::jsonb AS part_drawing_2d
FROM rfq_page r
    JOIN rfq_parts rp ON rp.rfq_id = r.id
WHERE rp.organization_id = p_organization_id
    AND rp.is_archived = FALSE
ORDER BY r.created_at DESC,
    r.id DESC,
    rp.created_at DESC;
$$;