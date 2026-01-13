-- --
-- Users
-- --
CREATE TYPE user_type_enum AS ENUM ('admin', 'supplier', 'customer');
create table if not exists users (
    id uuid primary key default gen_random_uuid (),
    email VARCHAR(255) unique not null,
    password_hash VARCHAR(255) not null,
    role user_type_enum not null default 'customer',
    role_id uuid references roles (id) on delete
    set null,
        organization_id uuid references organizations (id) on delete
    set null,
        created_at timestamp with time zone default CURRENT_TIMESTAMP,
        updated_at timestamp with time zone default CURRENT_TIMESTAMP,
        name VARCHAR(255),
        phone VARCHAR(20),
);
create index idx_users_email on users (email);
-- --
-- Organizationsstock_material_type
-- --
CREATE TABLE IF NOT EXISTS organizations { id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(255) NOT NULL,
display_name VARCHAR(255),
address TEXT,
organization_type TEXT NOT NULL DEFAULT 'customer',
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP };
-- --
-- Refresh Tokens
-- --
CREATE table IF NOT EXISTS refresh_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token text not null,
    created_at timestamp default now(),
    expires_at timestamp,
    updated_at timestamp default now()
) CREATE TABLE IF NOT EXISTS referral_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);
-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_referral_sources_user_id ON referral_sources(user_id);
-- Optional: if you query by source (analytics / reporting)
CREATE INDEX IF NOT EXISTS idx_referral_sources_source ON referral_sources(source);