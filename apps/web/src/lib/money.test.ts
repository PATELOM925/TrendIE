import { describe, expect, it } from 'vitest';
import { formatTokenAmount, parseTokenAmount } from './money';

describe('USDC / USDT amount conversion', () => {
  it('converts up to six decimal places to integer base units without floating point', () => {
    expect(parseTokenAmount('24.5')).toBe('24500000');
    expect(parseTokenAmount('0.000001')).toBe('1');
    expect(parseTokenAmount('1200')).toBe('1200000000');
  });

  it('rejects zero, negative, excess precision, leading zeros, and oversized values', () => {
    for (const value of ['0', '-1', '1.0000001', '01', '1e3', '9'.repeat(40)]) {
      expect(parseTokenAmount(value)).toBeNull();
    }
  });

  it('formats exact units without number coercion', () => {
    expect(formatTokenAmount('12345678', 'USDC')).toBe('12.345678 USDC');
    expect(formatTokenAmount('1000000', 'USDT')).toBe('1 USDT');
    expect(formatTokenAmount('not-an-integer', 'USDT')).toBe('Unknown USDT amount');
  });
});
