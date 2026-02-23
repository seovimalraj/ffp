create table uploads (
    id uuid primary key default gen_random_uuid(),
    file_name text,
    file_url text
);