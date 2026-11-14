import { describe, expect, it } from 'vitest';
import { inspectText } from './index.js';
import { cleanListing, maliciousListing } from './fixtures.js';

describe('advisory text inspection', () => {
  it('flags hostile seller instructions and retains source offsets', () => {
    const clean = inspectText(JSON.stringify(cleanListing));
    const hostile = inspectText(JSON.stringify(maliciousListing));
    expect(clean.findings).toHaveLength(0);
    expect(hostile.findings.length).toBeGreaterThan(0);
    expect(hostile.findings.every((finding) => finding.start >= 0 && finding.end <= hostile.sourceChars)).toBe(true);
  });
});
