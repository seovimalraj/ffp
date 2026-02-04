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
CREATE OR REPLACE FUNCTION get_user_rfqs_with_parts_count_infinite_v2(
        p_user_id UUID,
        p_status VARCHAR DEFAULT NULL,
        p_limit INTEGER DEFAULT 20,
        p_cursor_created_at TIMESTAMP DEFAULT NULL,
        p_cursor_id UUID DEFAULT NULL,
        p_rfq_type VARCHAR DEFAULT NULL
    ) RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$ WITH base_rfqs AS (
        SELECT r.id,
            r.rfq_code,
            r.user_id,
            r.final_price,
            r.status,
            r.created_at,
            r.updated_at,
            r.order_id,
            r.rfq_type
        FROM rfq r
        WHERE r.user_id = p_user_id
            AND (
                p_status IS NULL
                OR r.status = p_status
            )
            AND (
                p_rfq_type IS NULL
                OR r.rfq_type = p_rfq_type
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
                OR p_cursor_id IS NULL
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
            r.rfq_type,
            -- count of non-archived parts
            COUNT(p.id) FILTER (
                WHERE p.is_archived = FALSE
            ) AS parts_count,
            -- list of part cad url + file name
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'cad_file_url',
                        p.cad_file_url,
                        'file_name',
                        p.file_name,
                        "snapshot_2d_url",
                        snapshot_2d_url
                    )
                ) FILTER (
                    WHERE p.is_archived = FALSE
                ),
                '[]'::jsonb
            ) AS parts
        FROM rfq_limited r
            LEFT JOIN rfq_parts p ON p.rfq_id = r.id
        GROUP BY r.id,
            r.rfq_code,
            r.user_id,
            r.final_price,
            r.status,
            r.created_at,
            r.updated_at,
            r.order_id,
            r.rfq_type
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
--
----
------- RFQ Status Summary
----
--
CREATE OR REPLACE FUNCTION get_rfq_status_summary(
        p_user_id UUID DEFAULT NULL,
        p_organization_id UUID DEFAULT NULL,
        p_rfq_type VARCHAR DEFAULT NULL
    ) RETURNS json LANGUAGE sql STABLE AS $$ WITH filtered_rfqs AS (
        SELECT status
        FROM rfq
        WHERE (
                p_user_id IS NULL
                OR user_id = p_user_id
            )
            AND (
                p_organization_id IS NULL
                OR organization_id = p_organization_id
            )
            AND (
                p_rfq_type IS NULL
                OR rfq_type = p_rfq_type
            )
    )
SELECT json_build_object(
        'total',
        (
            SELECT COUNT(*)::INT
            FROM filtered_rfqs
        ),
        'by_status',
        COALESCE(
            (
                SELECT json_agg(
                        json_build_object(
                            'status',
                            status,
                            'count',
                            status_count
                        )
                    )
                FROM (
                        SELECT status,
                            COUNT(*)::INT AS status_count
                        FROM filtered_rfqs
                        GROUP BY status
                    ) s
            ),
            '[]'::json
        )
    );
$$;