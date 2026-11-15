import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { extractPdfUpload, PDF_MAX_BYTES, PdfUploadError } from './pdf-inspector';

const origin = 'http://127.0.0.1:3001';
const signature = new TextEncoder().encode('%PDF-1.7\nfixture');

function upload(file: File, requestOrigin = origin): Request {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('intentId', 'int_demo');
  return new Request(`${origin}/api/pdf`, {
    method: 'POST',
    headers: { origin: requestOrigin },
    body: form,
  });
}

describe('PDF upload extraction', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the source PDF temporary and returns bounded extracted evidence', async () => {
    let temporaryPath = '';
    const pageText = 'A'.repeat(12_500);
    const result = await extractPdfUpload(
      upload(new File([signature], 'invoice.pdf', { type: 'application/pdf' })),
      async (path) => {
        temporaryPath = path;
        expect(existsSync(path)).toBe(true);
        return {
          pageCount: 2,
          textChars: pageText.length * 2,
          pages: [{ page: 1, text: pageText }, { page: 2, text: pageText }],
          limitations: ['text extraction is advisory'],
        };
      },
    );

    expect(result.text).toHaveLength(20_000);
    expect(result.extractedChars).toBe(25_000);
    expect(result.truncated).toBe(true);
    expect(result.source).toBe('uploaded-pdf:invoice.pdf');
    expect(existsSync(temporaryPath)).toBe(false);
  });

  it('rejects cross-origin uploads and malformed PDF content before extraction', async () => {
    const inspect = vi.fn();
    await expect(extractPdfUpload(upload(new File([signature], 'invoice.pdf', { type: 'application/pdf' }), 'https://attacker.test'), inspect))
      .rejects.toMatchObject({ status: 403 });
    await expect(extractPdfUpload(upload(new File(['not pdf'], 'invoice.pdf', { type: 'application/pdf' }), origin), inspect))
      .rejects.toMatchObject({ status: 400 });
    expect(inspect).not.toHaveBeenCalled();
  });

  it('rejects uploads over 5 MB before creating a temporary file', async () => {
    const inspect = vi.fn();
    const oversized = new Uint8Array(PDF_MAX_BYTES + 1);
    oversized.set(signature);
    await expect(extractPdfUpload(upload(new File([oversized], 'large.pdf', { type: 'application/pdf' }), origin), inspect))
      .rejects.toMatchObject({ status: 413 });
    expect(inspect).not.toHaveBeenCalled();
  });

  it('cleans up the temporary source when extraction rejects an encrypted or unsupported PDF', async () => {
    let temporaryPath = '';
    await expect(extractPdfUpload(
      upload(new File([signature], 'encrypted.pdf', { type: 'application/pdf' })),
      async (path) => {
        temporaryPath = path;
        throw new PdfUploadError(422, 'unsupported');
      },
    )).rejects.toMatchObject({ status: 422 });
    expect(existsSync(temporaryPath)).toBe(false);
  });

  it('rejects extractor output beyond the configured character limit', async () => {
    await expect(extractPdfUpload(
      upload(new File([signature], 'too-long.pdf', { type: 'application/pdf' })),
      async () => ({
        pageCount: 1,
        textChars: 100_001,
        pages: [{ page: 1, text: 'A'.repeat(100_001) }],
        limitations: [],
      }),
    )).rejects.toMatchObject({ status: 422 });
  });

  it('validates supplementary Unicode using Python-compatible code point counts', async () => {
    const result = await extractPdfUpload(
      upload(new File([signature], 'unicode.pdf', { type: 'application/pdf' })),
      async () => ({
        pageCount: 1,
        textChars: 1,
        pages: [{ page: 1, text: '😀' }],
        limitations: [],
      }),
    );

    expect(result.extractedChars).toBe(1);
    expect(result.text).toBe('😀');
    expect(result.intentId).toBe('int_demo');
  });

  it('reports truncation caused by page separator newlines', async () => {
    const firstPage = 'A'.repeat(10_000);
    const secondPage = 'B'.repeat(10_000);
    const result = await extractPdfUpload(
      upload(new File([signature], 'two-pages.pdf', { type: 'application/pdf' })),
      async () => ({
        pageCount: 2,
        textChars: 20_000,
        pages: [{ page: 1, text: firstPage }, { page: 2, text: secondPage }],
        limitations: [],
      }),
    );

    expect(result.extractedChars).toBe(20_000);
    expect(result.truncated).toBe(true);
    expect(Array.from(result.text)).toHaveLength(20_000);
  });

  it('rejects browser-supplied evidence fields alongside the PDF', async () => {
    const form = new FormData();
    form.append('file', new File([signature], 'invoice.pdf', { type: 'application/pdf' }));
    form.append('intentId', 'int_demo');
    form.append('inspectionText', 'forged text');
    const request = new Request(`${origin}/api/pdf`, {
      method: 'POST',
      headers: { origin },
      body: form,
    });
    const inspect = vi.fn();

    await expect(extractPdfUpload(request, inspect)).rejects.toMatchObject({ status: 400 });
    expect(inspect).not.toHaveBeenCalled();
  });

  it('rejects encrypted-file extraction errors with a safe message and status', async () => {
    await expect(extractPdfUpload(
      upload(new File([signature], 'encrypted.pdf', { type: 'application/pdf' })),
      async () => { throw new PdfUploadError(422, 'encrypted'); },
    )).rejects.toBeInstanceOf(PdfUploadError);
  });
});
