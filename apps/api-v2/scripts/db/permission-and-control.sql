-- ============================================================
-- PERMISSIONS
-- ============================================================

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    meta Text not null DEFAULT '',
    category VARCHAR(255),
    allowed_user_types user_type_enum[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_permissions_code ON permissions(code);


-- ============================================================
-- ROLE_TEMPLATES
-- ============================================================

CREATE TABLE role_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ROLE_TEMPLATE_PERMISSIONS
-- ============================================================

CREATE TABLE role_template_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_template_id UUID NOT NULL REFERENCES role_templates(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_template_id, permission_id)
);

-- ============================================================

-- ============================================================
-- ROLES
-- ============================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_template_id UUID REFERENCES role_templates(id),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, name)
);


-- ============================================================
-- ROLE_PERMISSIONS
-- ============================================================

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id),
    user_id UUID REFERENCES users(id), -- NULL = applies to all users in role
    is_granted BOOLEAN NOT NULL,
    granted_by UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_user ON role_permissions(user_id);

-- ============================================================
-- GENERAL_ORGANIZATION_ROLES
-- ============================================================

CREATE TABLE general_organization_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    is_owner BOOLEAN DEFAULT FALSE,
    is_protected BOOLEAN DEFAULT FALSE,
    status org_member_status_enum NOT NULL DEFAULT 'active',
    assigned_by UUID REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, user_id, role_id)
);

-- ============================================================
-- PERMISSION_AUDIT_LOG
-- ============================================================

CREATE TABLE permission_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action permission_action_enum NOT NULL,
    target_user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    permission_code VARCHAR(255),
    performed_by UUID REFERENCES users(id),
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);