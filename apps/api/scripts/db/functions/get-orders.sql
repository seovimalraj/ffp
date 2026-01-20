CREATE OR REPLACE FUNCTION get_orders (
        p_organization_id UUID,
        p_status TEXT DEFAULT NULL,
        p_payment_status TEXT DEFAULT NULL,
        p_rfq_id UUID DEFAULT NULL,
        p_limit INT DEFAULT 20,
        p_offset INT DEFAULT 0
    ) RETURNS TABLE (
        order_id UUID,
        order_code TEXT,
        rfq_id UUID,
        status TEXT,
        payment_status TEXT,
        subtotal NUMERIC(12, 2),
        shipping_cost NUMERIC(12, 2),
        tax_amount NUMERIC(12, 2),
        total_amount NUMERIC(12, 2),
        created_at TIMESTAMP,
        confirmed_at TIMESTAMP,
        part_count INT,
        organization_name TEXT
    ) LANGUAGE sql STABLE AS $$
SELECT o.id AS order_id,
    o.order_code,
    o.rfq_id,
    o.status,
    o.payment_status,
    o.subtotal,
    o.shipping_cost,
    o.tax_amount,
    o.total_amount,
    o.created_at,
    o.confirmed_at,
    COUNT(op.id)::INT AS part_count,
    org.name AS organization_name
FROM orders o
    JOIN organizations org ON org.id = o.organization_id
    LEFT JOIN order_parts op ON op.order_id = o.id
WHERE (
        p_organization_id IS NULL
        OR o.organization_id = p_organization_id
    )
    AND (
        p_status IS NULL
        OR o.status = p_status
    )
    AND (
        p_payment_status IS NULL
        OR o.payment_status = p_payment_status
    )
    AND (
        p_rfq_id IS NULL
        OR o.rfq_id = p_rfq_id
    )
GROUP BY o.id,
    org.name
ORDER BY o.created_at DESC
LIMIT p_limit OFFSET p_offset;
$$;
CREATE OR REPLACE FUNCTION get_orders_infinite (
        p_organization_id UUID,
        p_status TEXT DEFAULT NULL,
        p_payment_status TEXT DEFAULT NULL,
        p_rfq_id UUID DEFAULT NULL,
        p_limit INT DEFAULT 20,
        p_cursor_created_at TIMESTAMP DEFAULT NULL,
        p_cursor_id UUID DEFAULT NULL
    ) RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER AS $$ WITH base_orders AS (
        SELECT o.id AS order_id,
            o.order_code,
            o.rfq_id,
            o.status,
            o.payment_status,
            o.subtotal,
            o.shipping_cost,
            o.tax_amount,
            o.total_amount,
            o.created_at,
            o.confirmed_at,
            org.name AS organization_name
        FROM orders o
            JOIN organizations org ON org.id = o.organization_id
        WHERE (
                p_organization_id IS NULL
                OR o.organization_id = p_organization_id
            )
            AND (
                p_status IS NULL
                OR o.status = p_status
            )
            AND (
                p_payment_status IS NULL
                OR o.payment_status = p_payment_status
            )
            AND (
                p_rfq_id IS NULL
                OR o.rfq_id = p_rfq_id
            )
    ),
    total_count AS (
        SELECT COUNT(*)::INT AS total
        FROM base_orders
    ),
    order_page AS (
        SELECT *
        FROM base_orders
        WHERE (
                p_cursor_created_at IS NULL
                OR (created_at, order_id) < (p_cursor_created_at, p_cursor_id)
            )
        ORDER BY created_at DESC,
            order_id DESC
        LIMIT p_limit + 1
    ), order_limited AS (
        SELECT *
        FROM order_page
        LIMIT p_limit
    ), orders_with_parts AS (
        SELECT ol.order_id,
            ol.order_code,
            ol.rfq_id,
            ol.status,
            ol.payment_status,
            ol.subtotal,
            ol.shipping_cost,
            ol.tax_amount,
            ol.total_amount,
            ol.created_at,
            ol.confirmed_at,
            ol.organization_name,
            COUNT(op.id)::INT AS part_count
        FROM order_limited ol
            LEFT JOIN order_parts op ON op.order_id = ol.order_id
        GROUP BY ol.order_id,
            ol.order_code,
            ol.rfq_id,
            ol.status,
            ol.payment_status,
            ol.subtotal,
            ol.shipping_cost,
            ol.tax_amount,
            ol.total_amount,
            ol.created_at,
            ol.confirmed_at,
            ol.organization_name
    )
SELECT jsonb_build_object(
        'data',
        COALESCE(
            jsonb_agg(
                to_jsonb(orders_with_parts)
                ORDER BY created_at DESC,
                    order_id DESC
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
            FROM order_page
        )
    )
FROM orders_with_parts;
$$;