CREATE TYPE promo_code_type AS ENUM ('percentage', 'flat', 'trial');
CREATE TABLE IF NOT EXISTS promo_code (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    code text NOT NULL CHECK (code = lower(code)),
    type promo_code_type NOT NULL DEFAULT 'percentage',
    context text not null,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_till timestamptz,
    redeemed boolean NOT NULL DEFAULT false,
    redeemed_at timestamptz,
    amount numeric(12, 2),
    percentage numeric(5, 2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_valid_window CHECK (
        valid_till IS NULL
        OR valid_till >= valid_from
    ),
    CONSTRAINT chk_type_fields CHECK (
        (
            type = 'flat'
            AND amount IS NOT NULL
            AND percentage IS NULL
        )
        OR (
            type = 'percentage'
            AND percentage IS NOT NULL
            AND amount IS NULL
        )
        OR (
            type = 'trial'
            AND amount IS NULL
            AND percentage IS NULL
        )
    ),
    CONSTRAINT chk_redeemed_timestamp CHECK (
        (
            redeemed = false
            AND redeemed_at IS NULL
        )
        OR (
            redeemed = true
            AND redeemed_at IS NOT NULL
        )
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_promo_code_scope ON promo_code (
    COALESCE(
        organization_id,
        '00000000-0000-0000-0000-000000000000'::uuid
    ),
    lower(code)
);
CREATE INDEX IF NOT EXISTS idx_promo_lookup_active ON promo_code (
    COALESCE(
        organization_id,
        '00000000-0000-0000-0000-000000000000'::uuid
    ),
    lower(code)
)
WHERE redeemed = false;
-- 
-- -- Redeem promo code
--
create or replace function redeem_promo_code(
        p_code text,
        p_organization_id uuid default null
    ) returns promo_code language plpgsql security definer
set search_path = public as $$
declare v_row promo_code;
begin
update promo_code
set redeemed = true,
    redeemed_at = now(),
    updated_at = now()
where id = (
        select id
        from promo_code
        where lower(code) = lower(p_code)
            and (
                organization_id = p_organization_id
                OR organization_id is null
            )
            and redeemed = false
            and now() >= valid_from
            and (
                valid_till is null
                or now() <= valid_till
            )
        order by organization_id desc nulls last
        limit 1 for
        update
    )
returning * into v_row;
return v_row;
end;
$$;