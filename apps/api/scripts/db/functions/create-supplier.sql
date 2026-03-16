CREATE OR REPLACE FUNCTION create_supplier(
    p_email VARCHAR,
    p_password VARCHAR,
    p_organization_name VARCHAR,
    p_name VARCHAR,
    p_phone VARCHAR DEFAULT NULL,
    p_logo_url VARCHAR DEFAULT NULL,
    p_address TEXT DEFAULT NULL
) 
RETURNS JSONB 
LANGUAGE plpgsql
AS $$

DECLARE 
    v_org_id UUID;
    v_role_id UUID;
    v_user users%ROWTYPE;
    v_otp_code TEXT;

BEGIN

    SELECT id INTO v_role_id
    FROM roles
    WHERE name = 'supplier'
    LIMIT 1;

    IF v_role_id IS NULL THEN 
        RAISE EXCEPTION 'Supplier role not found in roles table';
    END IF;


    INSERT INTO organizations (
        name,
        display_name,
        organization_type,
        logo_url,
        address
    )
    VALUES (
        p_organization_name,
        p_organization_name,
        'supplier',
        p_logo_url,
        p_address
    )
    RETURNING id INTO v_org_id;


    INSERT INTO users (
        email,
        password_hash,
        organization_id,
        role_id,
        role,
        name,
        phone
    )
    VALUES (
        p_email,
        p_password,
        v_org_id,
        v_role_id,
        'supplier',
        p_name,
        p_phone
    )
    RETURNING * INTO v_user;

    v_otp_code := request_otp(p_email);

    RETURN jsonb_build_object(
        'user', jsonb_build_object(
            'id', v_user.id,
            'email', v_user.email,
            'name', v_user.name,
            'phone', v_user.phone,
            'organization_id', v_user.organization_id
        ),
        'otp_code', v_otp_code
    );

EXCEPTION

    WHEN unique_violation THEN
        RAISE EXCEPTION 
        'User or Organization already exists (email: %, organization: %)',
        p_email,
        p_organization_name
        USING ERRCODE = '23505';

    WHEN OTHERS THEN
        RAISE;

END;
$$;