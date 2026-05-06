CREATE TABLE notification (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message text NOT NULL,
    meta_data JSONB DEFAULT '{}'::jsonb,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id uuid not null references organizations(id),
    is_read boolean DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_user_created_at 
ON notification(user_id, created_at DESC);