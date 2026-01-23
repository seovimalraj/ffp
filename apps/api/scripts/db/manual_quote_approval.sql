CREATE TABLE IF NOT EXISTS manual_quote_approval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq(id),
    -- UNIQUE automatically creates an index, no need for a manual one
    rfq_part_id UUID UNIQUE NOT NULL REFERENCES rfq_parts(id),
    is_approved BOOLEAN DEFAULT FALSE,
    -- Removed 'DEFAULT now()' so it stays NULL until approval actually occurs
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES users(id)
);
-- Index for fast lookups of all approvals under a single RFQ
CREATE INDEX idx_mqa_rfq_id ON manual_quote_approval(rfq_id);
-- Index for filtering or sorting by approval date
CREATE INDEX idx_mqa_approved_at ON manual_quote_approval(approved_at);
-- Optional: Index on the approver if you plan to report on user activity
CREATE INDEX idx_mqa_approved_by ON manual_quote_approval(approved_by);