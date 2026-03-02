CREATE TABLE IF NOT EXISTS blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    link TEXT NOT NULL,
    image_url TEXT NOT NULL,
    showcase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

alter table blogs add column tag text not null default ""

CREATE INDEX IF NOT EXISTS idx_blogs_created_at_desc
ON blogs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blogs_showcase_created_at
ON blogs (created_at DESC)
WHERE showcase = true;