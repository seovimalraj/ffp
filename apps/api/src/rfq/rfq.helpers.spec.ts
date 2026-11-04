import {
  getOrderBlockReason,
  getPricingLockReason,
  isSwitchableProcess,
} from './rfq.helpers';

describe('getOrderBlockReason', () => {
  const priced = { status: 'processed', final_price: 500 };

  it('allows an order when every part is priced and the total matches', () => {
    const parts = [priced, { status: 'processed', final_price: 200 }];
    expect(getOrderBlockReason(parts, 700)).toBeNull();
  });

  it.each(['queued', 'processing'])('blocks while a part is %s', (status) => {
    const parts = [priced, { status, final_price: 200 }];
    expect(getOrderBlockReason(parts, 700)).toMatch(/being analyzed/);
  });

  it.each([0, null, undefined])('blocks a part priced %s', (final_price) => {
    const parts = [priced, { status: 'processed', final_price }];
    expect(getOrderBlockReason(parts, 500)).toMatch(/no price/);
  });

  it('blocks when the subtotal no longer matches the parts', () => {
    expect(getOrderBlockReason([priced], 450)).toMatch(/have changed/);
  });

  it('ignores archived parts, including unpriced ones', () => {
    const parts = [
      priced,
      { status: 'queued', final_price: 0, is_archived: true },
      { status: 'processed', final_price: 900, is_archived: true },
    ];
    expect(getOrderBlockReason(parts, 500)).toBeNull();
  });
});

describe('isSwitchableProcess', () => {
  it.each(['cnc-milling', 'cnc-turning', 'sheet-metal'])('allows %s', (process) => {
    expect(isSwitchableProcess(process)).toBe(true);
  });

  it.each(['manual-quote', 'cnc-machining', 'injection-molding', '', undefined])(
    'rejects %s',
    (process) => {
      expect(isSwitchableProcess(process)).toBe(false);
    },
  );
});

describe('getPricingLockReason', () => {
  it.each(['paid', 'payment pending'])(
    'locks a %s RFQ for admins and customers',
    (status) => {
      expect(getPricingLockReason({ status }, 'admin')).not.toBeNull();
      expect(getPricingLockReason({ status }, 'customer')).not.toBeNull();
    },
  );

  it('locks any RFQ that has an order, whatever its status', () => {
    const rfq = { status: 'submitted', order_id: 'order-1' };
    expect(getPricingLockReason(rfq, 'admin')).not.toBeNull();
    expect(getPricingLockReason(rfq, 'customer')).not.toBeNull();
  });

  it('lets only an admin change prices on a manual RFQ', () => {
    const rfq = { status: 'under review', rfq_type: 'manual' };
    expect(getPricingLockReason(rfq, 'admin')).toBeNull();
    expect(getPricingLockReason(rfq, 'customer')).not.toBeNull();
  });

  it('allows price changes on a general RFQ with no order', () => {
    const rfq = { status: 'draft', rfq_type: 'general', order_id: null };
    expect(getPricingLockReason(rfq, 'admin')).toBeNull();
    expect(getPricingLockReason(rfq, 'customer')).toBeNull();
  });
});
