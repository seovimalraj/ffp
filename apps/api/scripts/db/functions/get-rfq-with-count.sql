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
CREATE OR REPLACE FUNCTION get_user_rfqs_with_parts_count_infinite(
        p_user_id UUID,
        p_status VARCHAR DEFAULT NULL,
        p_limit INTEGER DEFAULT 20,
        p_cursor_created_at TIMESTAMP DEFAULT NULL,
        p_cursor_id UUID DEFAULT NULL
    ) RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$ WITH base_rfqs AS (
        SELECT r.id,
            r.rfq_code,
            r.user_id,
            r.final_price,
            r.status,
            r.created_at,
            r.updated_at,
            r.order_id
        FROM rfq r
        WHERE r.user_id = p_user_id
            AND (
                p_status IS NULL
                OR r.status = p_status
            )
    ),
    total_count AS (
        SELECT COUNT(*)::INT AS total
        FROM base_rfqs
    ),
    rfq_page AS (
        SELECT *
        FROM base_rfqs
        WHERE (
                p_cursor_created_at IS NULL
                OR (created_at, id) < (p_cursor_created_at, p_cursor_id)
            )
        ORDER BY created_at DESC,
            id DESC
        LIMIT p_limit + 1
    ), rfq_limited AS (
        SELECT *
        FROM rfq_page
        ORDER BY created_at DESC,
            id DESC
        LIMIT p_limit
    ), rfqs_with_parts AS (
        SELECT r.id,
            r.rfq_code,
            r.user_id,
            r.final_price,
            r.status,
            r.created_at,
            r.updated_at,
            r.order_id,
            COUNT(p.id) AS parts_count
        FROM rfq_limited r
            LEFT JOIN rfq_parts p ON p.rfq_id = r.id
            AND p.is_archived = FALSE
        GROUP BY r.id,
            r.rfq_code,
            r.user_id,
            r.final_price,
            r.status,
            r.created_at,
            r.updated_at,
            r.order_id
    )
SELECT jsonb_build_object(
        'data',
        COALESCE(
            jsonb_agg(
                to_jsonb(rfqs_with_parts)
                ORDER BY created_at DESC,
                    id DESC
            ),
            '[]'::jsonb
        ),
        'total',
        (
            SELECT total
            FROM total_count
        ),
        'hasMore',
        (
            SELECT COUNT(*) > p_limit
            FROM rfq_page
        )
    )
FROM rfqs_with_parts;
$$;