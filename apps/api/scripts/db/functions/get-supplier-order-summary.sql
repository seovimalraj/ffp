CREATE OR REPLACE FUNCTION get_supplier_order_metrics(
    p_user_id UUID
) RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_organization_id UUID;
    v_role TEXT;
BEGIN
    -- Fetch role and organization
    SELECT role, organization_id
    INTO v_role, v_organization_id
    FROM users
    WHERE id = p_user_id;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User % not found', p_user_id;
    END IF;

    -- Enforce supplier role
    IF v_role <> 'supplier' THEN
        RAISE EXCEPTION 'User % is not a supplier', p_user_id;
    END IF;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Supplier % has no organization', p_user_id;
    END IF;

    RETURN (
        SELECT json_build_object(
            'total', COUNT(*)::INT,
            'completed', COUNT(*) FILTER (WHERE status = 'completed')::INT,
            'active', COUNT(*) FILTER (WHERE status <> 'completed')::INT
        )
        FROM orders
        WHERE assigned_supplier = v_organization_id
    );
END;
$$;