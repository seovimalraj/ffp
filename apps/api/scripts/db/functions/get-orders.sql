CREATE OR REPLACE FUNCTION get_orders (
        p_organization_id UUID DEFAULT NULL,
        p_supplier_id UUID DEFAULT NULL,
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
        p_supplier_id IS NULL
        OR o.assigned_supplier = p_supplier_id
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
        p_organization_id UUID DEFAULT NULL,
        p_supplier_id UUID DEFAULT NULL,
        p_status TEXT DEFAULT NULL,
        p_payment_status TEXT DEFAULT NULL,
        p_rfq_id UUID DEFAULT NULL,
        p_limit INT DEFAULT 20,
        p_cursor_created_at TIMESTAMP DEFAULT NULL,
        p_cursor_id UUID DEFAULT NULL,
        p_search TEXT DEFAULT NULL
    ) RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER AS $$ WITH base_orders AS (
        SELECT o.id AS order_id,
            o.order_code,
            o.rfq_id,
            o.organization_id,
            o.status,
            o.payment_status,
            o.subtotal,
            o.shipping_cost,
            o.tax_amount,
            o.total_amount,
            o.estimated_ship_date,
            o.estimated_delivery_date,
            o.created_at,
            o.confirmed_at,
            o.assigned_supplier,
            org.name AS organization_name,
            sorg.name AS supplier_name
        FROM orders o
            JOIN organizations org ON org.id = o.organization_id
            LEFT JOIN organizations sorg ON sorg.id = o.assigned_supplier
        WHERE (
                p_organization_id IS NULL
                OR o.organization_id = p_organization_id
            )
            AND (
                p_supplier_id IS NULL
                OR o.assigned_supplier = p_supplier_id
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
            AND (
                p_search IS NULL
                OR o.order_code ILIKE '%' || p_search || '%'
                OR org.name ILIKE '%' || p_search || '%'
                OR sorg.name ILIKE '%' || p_search || '%'
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
            ol.organization_id,
            ol.status,
            ol.payment_status,
            ol.subtotal,
            ol.shipping_cost,
            ol.tax_amount,
            ol.total_amount,
            ol.estimated_ship_date,
            ol.estimated_delivery_date,
            ol.created_at,
            ol.confirmed_at,
            ol.organization_name,
            ol.assigned_supplier,
            ol.supplier_name,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id',
                        op.id,
                        'part_code',
                        op.part_code,
                        'part_name',
                        op.part_name,
                        'quantity',
                        op.quantity,
                        'unit_price',
                        op.unit_price,
                        'total_price',
                        op.total_price,
                        'status',
                        op.status,
                        'file_name',
                        rp.file_name,
                        'cad_file_url',
                        rp.cad_file_url,
                        'snapshot_2d_url',
                        rp.snapshot_2d_url
                    )
                    ORDER BY op.created_at
                ) FILTER (
                    WHERE op.id IS NOT NULL
                ),
                '[]'::jsonb
            ) AS parts,
            COUNT(op.id)::INT AS part_count
        FROM order_limited ol
            LEFT JOIN order_parts op ON op.order_id = ol.order_id
            LEFT JOIN rfq_parts rp ON rp.id = op.rfq_part_id
        GROUP BY ol.order_id,
            ol.order_code,
            ol.rfq_id,
            ol.organization_id,
            ol.status,
            ol.payment_status,
            ol.subtotal,
            ol.shipping_cost,
            ol.tax_amount,
            ol.total_amount,
            ol.estimated_ship_date,
            ol.estimated_delivery_date,
            ol.created_at,
            ol.confirmed_at,
            ol.organization_name,
            ol.assigned_supplier,
            ol.supplier_name
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
--
----
------- RFQ Status Summary
----
--
CREATE OR REPLACE FUNCTION get_order_status_summary(
        p_user_id UUID,
        p_order_status VARCHAR DEFAULT NULL
    ) RETURNS JSON LANGUAGE plpgsql STABLE AS $$
DECLARE v_organization_id UUID;
v_role TEXT;
BEGIN -- Fetch role and organization
SELECT role,
    organization_id INTO v_role,
    v_organization_id
FROM users
WHERE id = p_user_id;
IF v_role IS NULL THEN RAISE EXCEPTION 'User % not found',
p_user_id;
END IF;
-- Non-admin users MUST have an organization
IF v_role <> 'admin'
AND v_organization_id IS NULL THEN RAISE EXCEPTION 'User % has no organization',
p_user_id;
END IF;
RETURN (
    WITH filtered_orders AS (
        SELECT status
        FROM orders
        WHERE -- Admin sees everything, Customer sees their organization, Supplier sees assigned orders
            (
                v_role = 'admin'
                OR (v_role = 'customer' AND organization_id = v_organization_id)
                OR (v_role = 'supplier' AND assigned_supplier = v_organization_id)
            )
            AND (
                p_order_status IS NULL
                OR status = p_order_status
            )
    )
    SELECT json_build_object(
            'total',
            (
                SELECT COUNT(*)::INT
                FROM filtered_orders
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
                            ORDER BY status
                        )
                    FROM (
                            SELECT status,
                                COUNT(*)::INT AS status_count
                            FROM filtered_orders
                            GROUP BY status
                        ) s
                ),
                '[]'::json
            )
        )
);
END;
$$;