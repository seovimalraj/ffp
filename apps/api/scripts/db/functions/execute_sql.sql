-- WARNING: Only allow trusted queries! Never expose dynamic user SQL directly in production.
create or replace function execute_sql(sql text)
returns void language plpgsql as $$
begin
    execute sql;
end;
$$;
