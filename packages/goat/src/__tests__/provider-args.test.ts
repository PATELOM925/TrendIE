import { describe, expect, it } from 'vitest';
import { GoatProviderArgsSchema } from '../provider-args.js';

const recipient = '0x000000000000000000000000000000000000dEaD';

describe('GOAT action arguments', () => {
  it('accepts only the actual transfer recipient', () => {
    expect(GoatProviderArgsSchema.parse({ recipient })).toEqual({ recipient });
  });

  it.each(['sender', 'destination', 'sourceRef'])('rejects unused %s metadata inside executable arguments', (key) => {
    expect(GoatProviderArgsSchema.safeParse({ recipient, [key]: 'untrusted-display-value' }).success).toBe(false);
  });
});
