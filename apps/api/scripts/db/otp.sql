-- 
-- -- Generate otp
-- 
CREATE OR REPLACE FUNCTION generate_otp() RETURNS TEXT AS $$ BEGIN RETURN floor(random() * (999999 - 100000 + 1) + 100000)::text;
END;
$$ LANGUAGE plpgsql VOLATILE;
CREATE TABLE IF NOT EXISTS otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL default generate_otp(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_otp_email ON otps(email);
-- 
-- -- request otp
-- 
CREATE OR REPLACE FUNCTION request_otp(target_email TEXT) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER -- Runs with elevated permissions
    AS $$
DECLARE new_code TEXT;
BEGIN
INSERT INTO otps (email, expires_at)
VALUES (target_email, NOW() + interval '10 minutes') ON CONFLICT (email) DO
UPDATE
SET code = generate_otp(),
    expires_at = EXCLUDED.expires_at
RETURNING code INTO new_code;
RETURN new_code;
END;
$$;