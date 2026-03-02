-- Insert demo organization
INSERT INTO public.organizations (id, name, slug, created_at, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001'::UUID, 'CNC Quote Demo', 'cnc-quote-demo', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000002'::UUID, 'Acme Corp', 'acme-corp', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000003'::UUID, 'TechCorp Industries', 'techcorp', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Insert demo auth users with bcrypt hashed passwords
-- Password for all: Demo123!
-- Bcrypt hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, email_confirmed_at)
VALUES 
    ('10000000-0000-0000-0000-000000000001'::UUID, 'admin@cncquote.com', crypt('Demo123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000002'::UUID, 'customer@acme.com', crypt('Demo123!', gen_salt('bf')), NOW(), NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000003'::UUID, 'engineer@techcorp.com', crypt('Demo123!', gen_salt('bf')), NOW(), NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert demo public users
INSERT INTO public.users (id, auth_user_id, email, full_name, role, organization_id, created_at, updated_at)
VALUES 
    ('20000000-0000-0000-0000-000000000001'::UUID, '10000000-0000-0000-0000-000000000001'::UUID, 'admin@cncquote.com', 'Admin User', 'admin', '00000000-0000-0000-0000-000000000001'::UUID, NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000002'::UUID, '10000000-0000-0000-0000-000000000002'::UUID, 'customer@acme.com', 'John Doe', 'member', '00000000-0000-0000-0000-000000000002'::UUID, NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000003'::UUID, '10000000-0000-0000-0000-000000000003'::UUID, 'engineer@techcorp.com', 'Jane Smith', 'member', '00000000-0000-0000-0000-000000000003'::UUID, NOW(), NOW())
ON CONFLICT (auth_user_id) DO NOTHING;
