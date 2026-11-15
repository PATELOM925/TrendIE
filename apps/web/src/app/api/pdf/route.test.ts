import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSameOriginMultipartWrite } from '@/lib/pdf-inspector';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getOwnedIntent: vi.fn(),
  verifyProposalWithGateway: vi.fn(),
  extractPdfUpload: vi.fn(),
}));

vi.mock('@/lib/gateway-verification', () => ({
  VerificationRequestError: class extends Error { constructor(readonly status: number, message: string) { super(message); } },
  getOwnedIntent: mocks.getOwnedIntent,
  verifyProposalWithGateway: mocks.verifyProposalWithGateway,
  verificationErrorResponse: (error: unknown) => Response.json({ error: error instanceof Error ? error.message : 'failed' }, { status: (error as { status?: number }).status ?? 500 }),
}));

vi.mock('@/lib/pdf-inspector', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/pdf-inspector')>(),
  extractPdfUpload: mocks.extractPdfUpload,
}));

const intent = {
  id: 'intent-1', seller: 'Seller', product: 'Part', maxAmount: '1200', currency: 'USDC' as const,
  allowedDestinations: ['recipient-1'], expiry: '2030-01-01T00:00:00.000Z', remainingUses: 1,
  createdAt: '2026-11-14T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.extractPdfUpload.mockResolvedValue({ intentId: intent.id, source: 'uploaded-pdf:invoice.pdf', text: 'Invoice text', pageCount: 1, extractedChars: 12, truncated: false, limitations: [] });
  mocks.getOwnedIntent.mockResolvedValue(intent);
  mocks.verifyProposalWithGateway.mockResolvedValue({
    decision: { id: 'decision-1', proposalHash: 'hash', decision: 'review', reasonCodes: ['INJECTION_FLAGGED'], timestamp: '2026-11-14T12:00:00.000Z' },
    inspection: { source: 'uploaded-pdf:invoice.pdf', findings: [{ code: 'ignore_prior_instructions', excerpt: 'Ignore prior instructions' }], truncated: false, sourceChars: 12, caveat: 'Heuristic scan.' },
  });
});

function sameOriginRequest(): Request {
  const form = new FormData();
  form.append('file', new File(['%PDF-1.7'], 'invoice.pdf', { type: 'application/pdf' }));
  form.append('intentId', intent.id);
  return new Request('http://127.0.0.1:3001/api/pdf', { method: 'POST', headers: { origin: 'http://127.0.0.1:3001' }, body: form });
}

describe('POST /api/pdf', () => {
  it('identifies cross-origin multipart writes as invalid', async () => {
    const form = new FormData();
    form.append('file', new File(['%PDF-1.7'], 'invoice.pdf', { type: 'application/pdf' }));
    const request = new Request('http://127.0.0.1:3001/api/pdf', {
      method: 'POST',
      headers: { origin: 'https://attacker.test' },
      body: form,
    });
    expect(isSameOriginMultipartWrite(request)).toBe(false);
  });

  it('extracts and verifies the uploaded PDF on the server against the selected owned authorization', async () => {
    const response = await POST(sameOriginRequest());
    expect(response.status).toBe(200);
    expect(mocks.getOwnedIntent).toHaveBeenCalledWith(intent.id);
    expect(mocks.verifyProposalWithGateway).toHaveBeenCalledWith(expect.objectContaining({
      intentId: intent.id, seller: intent.seller, amount: intent.maxAmount, destination: 'recipient-1', sourceRef: 'uploaded-pdf:invoice.pdf',
    }), { source: 'uploaded-pdf:invoice.pdf', text: 'Invoice text' }, { truncated: false, sourceChars: 12 });
    const result = await response.json();
    expect(result.verification.decision.decision).toBe('review');
    expect(result.verification.inspection.findings).toHaveLength(1);
    expect(result.proposal.sourceRef).toBe('uploaded-pdf:invoice.pdf');
  });

  it('does not submit a PDF proposal when the selected authorization has no allowed destination', async () => {
    mocks.getOwnedIntent.mockResolvedValue({ ...intent, allowedDestinations: [] });
    const response = await POST(sameOriginRequest());
    expect(response.status).toBe(409);
    expect(mocks.verifyProposalWithGateway).not.toHaveBeenCalled();
  });

  it('passes server-derived extraction truncation metadata to gateway evidence', async () => {
    mocks.extractPdfUpload.mockResolvedValue({
      intentId: intent.id, source: 'uploaded-pdf:invoice.pdf', text: 'A'.repeat(20_000), pageCount: 3,
      extractedChars: 42_000, truncated: true, limitations: ['output limited to first 20,000 characters'],
    });

    const response = await POST(sameOriginRequest());
    expect(response.status).toBe(200);
    expect(mocks.verifyProposalWithGateway).toHaveBeenCalledWith(
      expect.any(Object), expect.objectContaining({ text: 'A'.repeat(20_000) }),
      { truncated: true, sourceChars: 42_000 },
    );
  });
});
