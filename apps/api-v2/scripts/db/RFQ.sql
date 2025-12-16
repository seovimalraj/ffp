-- Parent table for the overall quote request
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    -- Link to your user table
    status VARCHAR(20) DEFAULT 'draft',
    -- draft, submitted, paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Main table for storing part configurations
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    -- Core Identity
    file_name VARCHAR(255) NOT NULL,
    cad_file_url TEXT NOT NULL,
    -- Path to S3 file
    cad_file_type VARCHAR(10),
    -- 'stl', 'step', etc.
    -- Manufacturing Specs
    material VARCHAR(50) NOT NULL,
    -- e.g., 'aluminum-6061'
    finish VARCHAR(50) NOT NULL,
    -- e.g., 'as-machined'
    tolerance VARCHAR(50) DEFAULT 'standard',
    quantity INTEGER DEFAULT 1,
    threads VARCHAR(50),
    inspection VARCHAR(50),
    lead_time_type VARCHAR(20) DEFAULT 'standard',
    notes TEXT,
    -- Computed Geometry (Stored as JSON for flexibility)
    -- Stores: { volume, surfaceArea, boundingBox: {x,y,z}, complexity, ... }
    geometry_data JSONB,
    -- Snapshot of pricing at time of configuration (Optional but recommended)
    -- Stores: { unitPrice, materialCost, machiningCost, ... }
    pricing_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Separate table for associated 2D drawings (1-to-Many relationship)
CREATE TABLE part_drawings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID REFERENCES parts(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    -- 'application/pdf', 'image/png'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);