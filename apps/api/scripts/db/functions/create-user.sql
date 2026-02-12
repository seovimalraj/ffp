CREATE OR REPLACE FUNCTION create_user(
        p_email VARCHAR,
        p_password VARCHAR,
        p_organization_name VARCHAR,
        p_name VARCHAR,
        p_phone VARCHAR,
        p_source VARCHAR
    ) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_org_id UUID;
v_role_id UUID;
v_user users;
v_otp_code TEXT;
BEGIN -- Fetch customer role id
SELECT id INTO v_role_id
FROM roles
WHERE name = 'customer'
LIMIT 1;
IF v_role_id IS NULL THEN RAISE EXCEPTION 'Customer role not found in roles table';
END IF;
-- Create organization
INSERT INTO organizations (
        name,
        display_name,
        organization_type
    )
VALUES (
        p_organization_name,
        p_organization_name,
        'customer'
    )
RETURNING id INTO v_org_id;
-- Create user
INSERT INTO users (
        email,
        password_hash,
        organization_id,
        role_id,
        name,
        phone
    )
VALUES (
        p_email,
        p_password,
        v_org_id,
        v_role_id,
        p_name,
        p_phone
    )
RETURNING * INTO v_user;
-- Create referral source
INSERT INTO referral_sources (user_id, source)
VALUES (v_user.id, p_source);
-- Generate OTP
v_otp_code := request_otp(p_email);
RETURN jsonb_build_object(
    'user',
    to_jsonb(v_user),
    'otp_code',
    v_otp_code
);
EXCEPTION
WHEN unique_violation THEN RAISE EXCEPTION 'User or organization already exists (email: %, organization: %)',
p_email,
p_organization_name USING ERRCODE = '23505';
WHEN OTHERS THEN RAISE;
END;
$$;