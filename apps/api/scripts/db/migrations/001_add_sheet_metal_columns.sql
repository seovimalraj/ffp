-- Migration: Add sheet metal support columns to rfq_parts
-- Date: 2026-01-21
-- Description: Adds process type and sheet thickness columns for sheet metal manufacturing support

-- Add process column for manufacturing process type
ALTER TABLE rfq_parts 
ADD COLUMN IF NOT EXISTS process VARCHAR(50) DEFAULT 'cnc-milling';

-- Add sheet_thickness_mm for sheet metal parts
ALTER TABLE rfq_parts 
ADD COLUMN IF NOT EXISTS sheet_thickness_mm NUMERIC(5, 2);

-- Add index on process for filtering by manufacturing type
CREATE INDEX IF NOT EXISTS idx_rfq_parts_process ON rfq_parts(process);

-- Comment on columns
COMMENT ON COLUMN rfq_parts.process IS 'Manufacturing process type: cnc-milling, cnc-turning, sheet-metal, laser, etc.';
COMMENT ON COLUMN rfq_parts.sheet_thickness_mm IS 'Sheet metal thickness in millimeters (for sheet metal parts only)';

-- Optional: Update existing parts to set process based on geometry detection
-- This is a one-time migration for existing data
-- UPDATE rfq_parts 
-- SET process = 'sheet-metal' 
-- WHERE geometry->>'recommendedProcess' ILIKE '%sheet%' 
--   AND process IS NULL;
