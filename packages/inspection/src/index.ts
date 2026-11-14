export type InspectionFinding = { code: string; start: number; end: number; excerpt: string };
export type InspectionResult = { findings: InspectionFinding[]; truncated: boolean; sourceChars: number };

const patterns: Array<[string, RegExp]> = [
  ['ignore_prior_instructions', /\b(ignore|disregard|override)\b.{0,80}\b(instructions?|rules?|previous|above)\b/gi],
  ['seller_redirection', /(?:\b(seller|merchant|vendor)\b.{0,80}\b(change|replace|redirect|instead|use)\b|\b(change|replace|redirect|instead|use)\b.{0,80}\b(seller|merchant|vendor)\b)/gi],
  ['item_redirection', /(?:\b(item|product|sku)\b.{0,80}\b(change|replace|redirect|instead|use)\b|\b(change|replace|redirect|instead|use)\b.{0,80}\b(item|product|sku)\b)/gi],
  ['amount_redirection', /(?:\b(amount|price|payment|charge)\b.{0,80}\b(change|replace|redirect|instead|use|increase)\b|\b(change|replace|redirect|instead|use|increase)\b.{0,80}\b(amount|price|payment|charge)\b)/gi],
  ['secret_request', /\b(wallet|private key|seed phrase|password|api key|credential)\b/gi],
];

export function inspectText(input: string, maxChars = 100_000, maxFindings = 100): InspectionResult {
  if (typeof input !== 'string') throw new TypeError('Inspection input must be text');
  if (!Number.isSafeInteger(maxChars) || maxChars < 1 || maxChars > 1_000_000) throw new RangeError('Invalid text limit');
  if (!Number.isSafeInteger(maxFindings) || maxFindings < 1 || maxFindings > 1_000) throw new RangeError('Invalid finding limit');
  const text = input.slice(0, maxChars);
  const findings: InspectionFinding[] = [];
  for (const [code, regex] of patterns) {
    regex.lastIndex = 0;
    for (let match = regex.exec(text); match && findings.length < maxFindings; match = regex.exec(text)) {
      const start = match.index;
      findings.push({ code, start, end: start + match[0].length, excerpt: match[0].slice(0, 160) });
      if (match[0].length === 0) regex.lastIndex++;
    }
    if (findings.length >= maxFindings) break;
  }
  findings.sort((a, b) => a.start - b.start || a.code.localeCompare(b.code));
  return { findings, truncated: input.length > text.length, sourceChars: text.length };
}
