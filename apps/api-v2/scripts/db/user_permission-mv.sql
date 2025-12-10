-- CREATE MATERIALIZED VIEW user_permission_codes_mv AS
-- SELECT DISTINCT
--     rp.user_id,
--     p.code AS permission_code,
--     p.id AS permission_id
-- FROM role_permissions rp
-- JOIN permissions p
--     ON p.id = rp.permission_id;

-- CREATE UNIQUE INDEX idx_user_permission_codes_mv_unique
-- ON user_permission_codes_mv (user_id, permission_code, permission_id);

CREATE OR REPLACE FUNCTION refresh_user_permission_codes_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS
$$
BEGIN
    -- Non-blocking for readers thanks to unique index
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_permission_codes_mv;
END;
$$;


REVOKE ALL ON FUNCTION refresh_user_permission_codes_mv() FROM PUBLIC;


