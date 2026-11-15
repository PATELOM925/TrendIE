import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/pdf', () => {
  it('rejects cross-origin requests before invoking the local extractor', async () => {
    const form = new FormData();
    form.append('file', new File(['%PDF-1.7'], 'invoice.pdf', { type: 'application/pdf' }));
    const request = new Request('http://127.0.0.1:3001/api/pdf', {
      method: 'POST',
      headers: { origin: 'https://attacker.test' },
      body: form,
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain('same-origin');
  });
});
