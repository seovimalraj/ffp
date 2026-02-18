create or replace function create_tech_request(
        p_user_id uuid,
        p_org_id uuid,
        p_quote_id uuid,
        p_email text,
        p_phone text,
        p_text text
    ) returns setof technical_support_request language plpgsql as $$ begin return query
insert into technical_support_request (
        user_id,
        organization_id,
        quote_id,
        user_email,
        user_phone,
        request_text
    )
values (
        p_user_id,
        p_org_id,
        p_quote_id,
        p_email,
        p_phone,
        p_text
    )
returning *;
end;
$$;