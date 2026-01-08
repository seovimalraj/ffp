create or replace function get_order_details (p_order_id UUID, p_organization_id UUID) RETURNS JSONB LANGUAGE plpgsql STABLE as $$
DECLARE v_result JSONB;
BEGIN
SELECT jsonb_build_object(
        'order',
        jsonb_build_object(
            'id',
            o.id,
            'order_code',
            o.order_code,
            'status',
            o.status,
            'payment_status',
            o.payment_status,
            'subtotal',
            o.subtotal,
            'shipping_cost',
            o.shipping_cost,
            'tax_amount',
            o.tax_amount,
            'total_amount',
            o.total_amount,
            'customs_info',
            o.customs_info,
            'address_snapshot',
            o.address_snapshot,
            'internal_notes',
            o.internal_notes,
            'created_at',
            o.created_at,
            'confirmed_at',
            o.confirmed_at
        ),
        'rfq',
        jsonb_build_object(
            'id',
            r.id,
            'rfq_code',
            r.rfq_code,
            'status',
            r.status,
            'final_price',
            r.final_price
        ),
        'shipping',
        (
            SELECT jsonb_build_object(
                    'shipping_method',
                    os.shipping_method,
                    'carrier',
                    os.carrier,
                    'service_level',
                    os.service_level,
                    'tracking_number',
                    os.tracking_number,
                    'shipping_information',
                    os.shipping_information,
                    'created_at',
                    os.created_at
                )
            FROM order_shipping os
            WHERE os.order_id = o.id
            LIMIT 1
        ), 'payments', (
            SELECT COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'payment_type',
                            opy.payment_type,
                            'payment_gateway',
                            opy.payment_gateway,
                            'transaction_id',
                            opy.transaction_id,
                            'amount_authorized',
                            opy.amount_authorized,
                            'amount_captured',
                            opy.amount_captured,
                            'status',
                            opy.status,
                            'created_at',
                            opy.created_at
                        )
                    ),
                    '[]'::jsonb
                )
            FROM order_payments opy
            WHERE opy.order_id = o.id
        ),
        'parts',
        (
            SELECT COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'order_part_id',
                            op.id,
                            'status',
                            op.status,
                            'quantity',
                            op.quantity,
                            'unit_price',
                            op.unit_price,
                            'total_price',
                            op.total_price,
                            'lead_time',
                            op.lead_time,
                            'lead_time_type',
                            op.lead_time_type,
                            'rfq_part',
                            jsonb_build_object(
                                'id',
                                rp.id,
                                'file_name',
                                rp.file_name,
                                'cad_file_url',
                                rp.cad_file_url,
                                'cad_file_type',
                                rp.cad_file_type,
                                'material',
                                rp.material,
                                'finish',
                                rp.finish,
                                'tolerance',
                                rp.tolerance,
                                'threads',
                                rp.threads,
                                'inspection',
                                rp.inspection,
                                'notes',
                                rp.notes,
                                'delivery_date',
                                rp.delivery_date,
                                'pricing',
                                rp.pricing,
                                'certificates',
                                rp.certificates,
                                'snapshot_2d_url',
                                rp.snapshot_2d_url
                            ),
                            'drawings_2d',
                            (
                                SELECT COALESCE(
                                        jsonb_agg(
                                            jsonb_build_object(
                                                'file_name',
                                                d.file_name,
                                                'file_url',
                                                d.file_url,
                                                'mime_type',
                                                d.mime_type
                                            )
                                        ),
                                        '[]'::jsonb
                                    )
                                FROM part_drawing_2d d
                                WHERE d.rfq_part_id = rp.id
                            ),
                            'confirmations',
                            (
                                SELECT COALESCE(
                                        jsonb_agg(
                                            jsonb_build_object(
                                                'type',
                                                c.confirmation_type,
                                                'status',
                                                c.status,
                                                'confirmed_at',
                                                c.confirmed_at,
                                                'notes',
                                                c.notes
                                            )
                                        ),
                                        '[]'::jsonb
                                    )
                                FROM order_part_confirmations c
                                WHERE c.order_part_id = op.id
                                    AND c.is_active = TRUE
                            )
                        )
                    ),
                    '[]'::jsonb
                )
            FROM order_parts op
                JOIN rfq_parts rp ON rp.id = op.rfq_part_id
            WHERE op.order_id = o.id
        )
    ) INTO v_result
FROM orders o
    JOIN organizations org ON org.id = o.organization_id
    LEFT JOIN rfq r ON r.id = o.rfq_id
WHERE o.id = p_order_id
    AND (
        p_organization_id IS NULL
        OR o.organization_id = p_organization_id
    );
IF v_result IS NULL THEN RAISE EXCEPTION 'Order % not found',
p_order_id;
END IF;
RETURN v_result;
END;
$$;