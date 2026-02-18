-- ENUM
create type request_status as enum (
    'pending',
    'inprogress',
    'resolved',
    'rejected'
);
-- TABLE
create table if not exists technical_support_request (
    id uuid primary key default gen_random_uuid(),
    code text unique,
    user_id uuid not null references users(id),
    organization_id uuid not null references organizations(id),
    quote_id uuid not null references rfq(id),
    user_email text not null,
    user_phone text not null,
    reject_reason text,
    request_text text not null,
    status request_status not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
-- SEQUENCE
create sequence if not exists tech_request_seq start 1 increment 1;
-- FUNCTION
create or replace function generate_tech_support_code() returns trigger as $$
declare seq_value bigint;
begin if new.code is null then seq_value := nextval('tech_request_seq');
new.code := 'FRI_TS_' || lpad(seq_value::text, 5, '0');
end if;
return new;
end;
$$ language plpgsql;
-- TRIGGER
create trigger ts_code_trigger before
insert on technical_support_request for each row execute function generate_tech_support_code();
create index idx_ts_user on technical_support_request(user_id);
create index idx_ts_org on technical_support_request(organization_id);
create index idx_ts_status on technical_support_request(status);
create or replace function set_updated_at() returns trigger as $$ begin new.updated_at = now();
return new;
end;
$$ language plpgsql;
create trigger ts_updated_at before
update on technical_support_request for each row execute function set_updated_at();