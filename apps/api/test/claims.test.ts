import { normalizeClaimValue } from '../src/claims/normalization';

describe('deterministic claim normalization', () => {
  it.each(['INR 2500', '₹2,500', 'Rs. 1,23,456.75'])('normalizes recognized INR values without floating point: %s', (value) => {
    const expected = value.includes('1,23,456') ? '12345675' : value.includes('₹') ? '250000' : '250000';
    expect(normalizeClaimValue('payment_amount', value)).toEqual({ currency: 'INR', amountMinorUnits: expected });
  });
  it('leaves unstated currency and unsupported claim types unnormalized', () => {
    expect(normalizeClaimValue('payment_amount', '2500')).toBeNull();
    expect(normalizeClaimValue('payment_amount', 'INR 25,00,0')).toBeNull();
    expect(normalizeClaimValue('statement', 'INR 2500')).toBeNull();
  });
});
