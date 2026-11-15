import type { DemoCurrency } from './types';

export const TOKEN_SCALE = 6;

export function parseTokenAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(trimmed)) return null;

  const [whole = '', fraction = ''] = trimmed.split('.');
  const units = `${whole}${fraction.padEnd(TOKEN_SCALE, '0')}`.replace(/^0+(?=\d)/, '');
  if (!/^\d+$/.test(units) || BigInt(units) <= 0n || units.length > 38) return null;
  return units;
}

export function formatTokenAmount(value: string, currency: DemoCurrency): string {
  if (!/^\d+$/.test(value)) return `Unknown ${currency} amount`;
  const units = BigInt(value);
  const whole = units / 10n ** BigInt(TOKEN_SCALE);
  const fraction = (units % 10n ** BigInt(TOKEN_SCALE)).toString().padStart(TOKEN_SCALE, '0');
  const significantFraction = fraction.replace(/0+$/, '');
  return `${whole.toString()}${significantFraction ? `.${significantFraction}` : ''} ${currency}`;
}

export function addBaseUnits(value: string, delta: bigint): string {
  if (!/^\d+$/.test(value)) return '0';
  const next = BigInt(value) + delta;
  return next > 0n ? next.toString() : '1';
}
