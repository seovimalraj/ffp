CREATE TYPE documentVisibility as enum ('customer', 'supplier', 'global')

CREATE TABLE order_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    -- e.g. invoice, packing_list, qc_report, drawing_2d, certificate
    document_url TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB,
    visibility documentVisibility DEFAULT 'global'::documentVisibility,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
-- Fast lookup by order
CREATE INDEX idx_order_documents_order_id ON order_documents(order_id);
-- Filter by document type (common in UIs)
CREATE INDEX idx_order_documents_type ON order_documents(document_type);
-- Active documents only
CREATE INDEX idx_order_documents_active ON order_documents(order_id)
WHERE is_active = TRUE;