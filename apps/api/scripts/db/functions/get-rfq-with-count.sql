-- CREATE OR REPLACE FUNCTION get_user_rfqs_with_parts_count(p_user_id UUID) RETURNS TABLE (
--         id UUID,
--         rfq_code VARCHAR,
--         user_id UUID,
--         final_price NUMERIC,
--         status VARCHAR,
--         created_at TIMESTAMP,
--         updated_at TIMESTAMP,
--         order_id UUID,
--         parts_count BIGINT
--     ) LANGUAGE sql AS $$
-- SELECT r.id,
--     r.rfq_code,
--     r.user_id,
--     r.final_price,
--     r.status,
--     r.created_at,
--     r.updated_at,
--     r.order_id,
--     COUNT(p.id) AS parts_count
-- FROM rfq r
--     LEFT JOIN rfq_parts p ON p.rfq_id = r.id
--     AND p.is_archived = FALSE
-- WHERE r.user_id = p_user_id
-- GROUP BY r.id
-- ORDER BY r.created_at DESC;
-- $$;
CREATE OR REPLACE FUNCTION get_user_rfqs_with_parts_count(
        p_user_id UUID,
        p_status VARCHAR DEFAULT NULL,
        p_limit INTEGER DEFAULT 20,
        p_cursor_created_at TIMESTAMP DEFAULT NULL,
        p_cursor_id UUID DEFAULT NULL
    ) RETURNS TABLE (
        id UUID,
        rfq_code VARCHAR,
        user_id UUID,
        final_price NUMERIC,
        status VARCHAR,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        order_id UUID,
        parts_count BIGINT
    ) LANGUAGE sql AS $$
SELECT r.id,
    r.rfq_code,
    r.user_id,
    r.final_price,
    r.status,
    r.created_at,
    r.updated_at,
    r.order_id,
    COUNT(p.id) AS parts_count
FROM rfq r
    LEFT JOIN rfq_parts p ON p.rfq_id = r.id
    AND p.is_archived = FALSE
WHERE r.user_id = p_user_id
    AND (
        p_status IS NULL
        OR r.status = p_status
    )
    AND (
        p_cursor_created_at IS NULL
        OR (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
    )
GROUP BY r.id
ORDER BY r.created_at DESC,
    r.id DESC
LIMIT p_limit;
$$;