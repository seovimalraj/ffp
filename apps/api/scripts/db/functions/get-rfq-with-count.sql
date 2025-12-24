CREATE OR REPLACE FUNCTION get_user_rfqs_with_parts_count(p_user_id UUID) RETURNS TABLE (
        id UUID,
        rfq_code VARCHAR,
        user_id UUID,
        final_price NUMERIC,
        status VARCHAR,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        parts_count BIGINT
    ) LANGUAGE sql AS $$
SELECT r.id,
    r.rfq_code,
    r.user_id,
    r.final_price,
    r.status,
    r.created_at,
    r.updated_at,
    COUNT(p.id) AS parts_count
FROM rfq r
    LEFT JOIN rfq_parts p ON p.rfq_id = r.id
    AND p.is_archived = FALSE
WHERE r.user_id = p_user_id
GROUP BY r.id
ORDER BY r.created_at DESC;
$$;