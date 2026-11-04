-- Migration: Standardize rfq_parts.final_price as the line total
-- Date: 2026-11-05
-- Description: Automatic pricing has always stored the line total, but the admin
-- manual quote form stored the unit price. The app now treats final_price as the
-- line total everywhere, so admin-entered prices on open manual quotes are converted.
--
-- HOW TO RUN
-- 1. Take a backup, then run the three REPORT queries and review the results.
-- 2. Run the transaction below. It ends in ROLLBACK so a first run changes nothing.
--    Check the row counts, then change ROLLBACK to COMMIT and run it again.
-- 3. Run it when the matching app version deploys. Until then, the deployed app
--    and these rows disagree about what final_price means.
-- Safe to re-run: converted parts are recorded and skipped.

-- REPORT 1: manual quotes that already have an order, NOT changed by this script.
-- The RFQ total was a sum of unit prices, so the order subtotal may have been too
-- low for any part with quantity > 1. Finance should review these. Quote pages will
-- show their final_price as a line total, so the unit price displayed will be low.
SELECT r.rfq_code, r.status, r.final_price AS rfq_total, o.order_code, o.subtotal,
       SUM(rp.final_price * rp.quantity) AS expected_subtotal
FROM rfq r
JOIN rfq_parts rp ON rp.rfq_id = r.id AND rp.is_archived = false
LEFT JOIN orders o ON o.rfq_id = r.id
WHERE r.rfq_type = 'manual'
  AND (r.order_id IS NOT NULL OR r.status IN ('paid', 'payment pending'))
GROUP BY r.rfq_code, r.status, r.final_price, o.order_code, o.subtotal
HAVING SUM(rp.final_price * rp.quantity) <> r.final_price;

-- REPORT 2: manual quotes still under review, NOT changed by this script. Their
-- prices may be automatic line totals or unsaved admin drafts, and the two can't be
-- told apart. An admin should check each one on the quote page before sending it.
SELECT r.rfq_code, rp.id AS part_id, rp.file_name, rp.quantity, rp.final_price
FROM rfq r
JOIN rfq_parts rp ON rp.rfq_id = r.id
WHERE r.rfq_type = 'manual'
  AND r.status = 'under review'
  AND r.order_id IS NULL
  AND rp.quantity > 1
  AND rp.final_price > 0;

-- REPORT 3: automatic quote orders whose part rows are overstated. Checkout sent the
-- line total as unit_price, so total_price became line total x quantity. Amounts
-- charged came from the RFQ total and are not affected. See the optional fix below.
-- Run this before deploying: later orders are correct but would be listed here too.
SELECT o.order_code, op.id AS order_part_id, op.part_name, op.quantity,
       op.unit_price, op.total_price
FROM order_parts op
JOIN orders o ON o.id = op.order_id
JOIN rfq r ON r.id = o.rfq_id
WHERE r.rfq_type <> 'manual'
  AND op.quantity > 1;

BEGIN;

CREATE TABLE IF NOT EXISTS _final_price_line_total_backfill (
  rfq_part_id UUID PRIMARY KEY,
  old_final_price NUMERIC(10, 2),
  converted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Published manual quotes with no order: every price here was saved by an admin
WITH converted AS (
  INSERT INTO _final_price_line_total_backfill (rfq_part_id, old_final_price)
  SELECT rp.id, rp.final_price
  FROM rfq_parts rp
  JOIN rfq r ON r.id = rp.rfq_id
  WHERE r.rfq_type = 'manual'
    AND r.status IN ('pending approval', 'quoted')
    AND r.order_id IS NULL
    AND rp.quantity > 1
    AND rp.final_price > 0
  ON CONFLICT (rfq_part_id) DO NOTHING
  RETURNING rfq_part_id
)
UPDATE rfq_parts rp
SET final_price = rp.final_price * rp.quantity
FROM converted c
WHERE rp.id = c.rfq_part_id;

-- Recalculate those quotes' totals the same way recalculateRfqTotal does
UPDATE rfq r
SET final_price = totals.total
FROM (
  SELECT rp.rfq_id, SUM(COALESCE(rp.final_price, 0)) AS total
  FROM rfq_parts rp
  WHERE rp.is_archived = false
    AND rp.rfq_id IN (
      SELECT p.rfq_id
      FROM rfq_parts p
      JOIN _final_price_line_total_backfill b ON b.rfq_part_id = p.id
    )
  GROUP BY rp.rfq_id
) totals
WHERE r.id = totals.rfq_id
  AND r.order_id IS NULL;

SELECT COUNT(*) AS converted_parts FROM _final_price_line_total_backfill;

-- OPTIONAL fix for REPORT 3. Run only after reviewing that report. It corrects the
-- per-part figures on existing automatic orders and does not change amounts charged.
-- It is NOT safe to re-run, so keep it commented out until you intend to apply it.
-- Replace the timestamp with when the new checkout deployed: orders placed after
-- that already have a true unit price and would otherwise be divided a second time.
-- UPDATE order_parts op
-- SET unit_price = ROUND(op.unit_price / op.quantity, 2),
--     total_price = op.unit_price
-- FROM orders o
-- JOIN rfq r ON r.id = o.rfq_id
-- WHERE op.order_id = o.id
--   AND r.rfq_type <> 'manual'
--   AND op.quantity > 1
--   AND o.created_at < 'REPLACE-WITH-DEPLOY-TIMESTAMP';

ROLLBACK; -- change to COMMIT after reviewing the row counts
