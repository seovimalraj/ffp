create type stock_material_type as enum ('block', 'rod', 'plate');
create type unit_type as enum (
    'mm',
    'cm',
    'm',
    'inch',
    'kg',
    'g',
    'lb'
);
create type currency_type as enum ('USD', 'INR', 'EUR');
create type material_status as enum ('active', 'inactive');
create table material (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE
);
CREATE INDEX idx_material_name ON material(name);
create table material_categories (
    id uuid primary key default gen_random_uuid(),
    name varchar(255),
    slug text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) create table general_materials (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null,
    category_id uuid references material_categories(id),
    description text,
    capacity numeric(10, 2),
    base_price numeric not null,
    currency currency_type not null default 'INR',
    stock_material stock_material_type not null,
    unit unit_type not null,
    status material_status not null default 'active',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
create index general_materials_code_idx on general_materials (code);
create index general_materials_category_idx on general_materials (category_id);
create index general_materials_category_stock_idx on general_materials (category_id, stock_material);