export enum RFQStatuses {
  Draft = 'draft',
  Submitted = 'submitted',
  UnderReview = 'under review',
  PendingApproval = 'pending approval',
  PaymentPending = 'payment pending',
  Paid = 'paid',
}

/** Processes a part can be switched to, which each have their own pricing path. */
export const SWITCHABLE_PROCESSES = [
  'cnc-milling',
  'cnc-turning',
  'sheet-metal',
] as const;

export function isSwitchableProcess(process: unknown): boolean {
  return (SWITCHABLE_PROCESSES as readonly unknown[]).includes(process);
}

/** Part columns that change a part's price when they change. */
export const PRICE_AFFECTING_PART_FIELDS = [
  'final_price',
  'quantity',
  'material',
  'finish',
  'tolerance',
  'lead_time_type',
  'process',
  'geometry',
  'sheet_thickness_mm',
  'is_archived',
] as const;

/**
 * Why an order can't be created from this RFQ yet, or null if it can. The order
 * copies these amounts and then locks them, so they have to be final and match
 * what the customer was shown.
 */
export function getOrderBlockReason(
  parts: {
    status?: string | null;
    final_price?: number | null;
    is_archived?: boolean | null;
  }[],
  subtotal: number,
): string | null {
  const activeParts = parts.filter((part) => !part.is_archived);
  if (
    activeParts.some((part) =>
      ['queued', 'processing'].includes(part.status ?? ''),
    )
  ) {
    return 'A part is still being analyzed. Please try again when it has finished.';
  }
  if (activeParts.some((part) => !(Number(part.final_price) > 0))) {
    return 'A part in this quote has no price yet. Please reopen the quote to update it.';
  }
  const partsTotal = activeParts.reduce(
    (sum, part) => sum + Number(part.final_price),
    0,
  );
  if (Math.abs(partsTotal - subtotal) > 0.02) {
    return 'The prices in this quote have changed. Please review them and try again.';
  }
  return null;
}

type PricingLockRfq = {
  status?: string | null;
  order_id?: string | null;
  rfq_type?: string | null;
};

/**
 * Why this RFQ's prices can't be changed by this role, or null if they can.
 * Once an order exists its amounts are fixed: create_order returns the existing
 * order unchanged, so a later price change would no longer match what is charged.
 * Prices on a manual RFQ are entered by an admin, so only an admin may change them.
 */
export function getPricingLockReason(
  rfq: PricingLockRfq,
  role: string,
): string | null {
  if (
    rfq.order_id ||
    rfq.status === RFQStatuses.Paid ||
    rfq.status === RFQStatuses.PaymentPending
  ) {
    return 'An order already exists for this quote, so its price is locked';
  }
  if (rfq.rfq_type === 'manual' && role !== 'admin') {
    return 'This quote was priced by our team, so its price is locked';
  }
  return null;
}
