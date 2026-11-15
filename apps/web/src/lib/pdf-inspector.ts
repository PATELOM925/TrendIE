import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const PDF_MAX_BYTES = 5_000_000;
export const PDF_MAX_PAGES = 20;
export const PDF_MAX_TEXT_CHARS = 100_000;
export const PDF_INSPECTION_TEXT_LIMIT = 20_000;
const PDF_REQUEST_OVERHEAD_BYTES = 64 * 1024;
const INSPECTOR_TIMEOUT_MS = 5_000;
const INSPECTOR_OUTPUT_LIMIT_BYTES = 1_200_000;

export type PdfInspection = {
  source: string;
  text: string;
  pageCount: number;
  extractedChars: number;
  truncated: boolean;
  limitations: string[];
};

export class PdfUploadError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'PdfUploadError';
  }
}

type ExtractedDocument = {
  pages: Array<{ page: number; text: string }>;
  pageCount: number;
  textChars: number;
  limitations: string[];
};

export function isSameOriginMultipartWrite(request: Request): boolean {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  const origin = request.headers.get('origin');
  if (contentType !== 'multipart/form-data' || !origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function extractPdfUpload(
  request: Request,
  inspect: (filePath: string) => Promise<unknown> = runPdfInspector,
): Promise<PdfInspection> {
  if (!isSameOriginMultipartWrite(request)) {
    throw new PdfUploadError(403, 'A same-origin PDF upload is required.');
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  const requestLimit = PDF_MAX_BYTES + PDF_REQUEST_OVERHEAD_BYTES;
  if (Number.isFinite(contentLength) && contentLength > requestLimit) {
    throw new PdfUploadError(413, 'PDF upload exceeds the 5 MB limit.');
  }

  const body = await readBoundedRequest(request, requestLimit);
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
      body: new Uint8Array(body),
    }).formData();
  } catch {
    throw new PdfUploadError(400, 'Upload must contain one valid PDF file.');
  }

  if ([...form.keys()].some((key) => key !== 'file') || form.getAll('file').length !== 1) {
    throw new PdfUploadError(400, 'Upload must contain exactly one PDF file.');
  }
  const uploaded = form.get('file');
  if (!(uploaded instanceof File)) throw new PdfUploadError(400, 'Upload must contain one PDF file.');
  if (uploaded.size === 0) throw new PdfUploadError(400, 'The PDF file is empty.');
  if (uploaded.size > PDF_MAX_BYTES) throw new PdfUploadError(413, 'PDF upload exceeds the 5 MB limit.');
  if (uploaded.name.length > 255 || !uploaded.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfUploadError(400, 'Choose a file with a .pdf extension.');
  }
  if (uploaded.type && uploaded.type !== 'application/pdf') {
    throw new PdfUploadError(400, 'The selected file must be a PDF.');
  }

  const bytes = Buffer.from(await uploaded.arrayBuffer());
  if (bytes.length > PDF_MAX_BYTES) throw new PdfUploadError(413, 'PDF upload exceeds the 5 MB limit.');
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new PdfUploadError(400, 'The uploaded file is not a valid PDF.');
  }

  const directory = await mkdtemp(join(tmpdir(), 'trendie-pdf-'));
  const filePath = join(directory, 'upload.pdf');
  try {
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
    const extracted = await inspect(filePath);
    const normalized = validateExtractedDocument(extracted);
    const filename = uploaded.name.replaceAll('\\', '/').split('/').at(-1) ?? 'invoice.pdf';
    const source = `uploaded-pdf:${filename.replace(/[\r\n\0]/g, '').slice(0, 120) || 'invoice.pdf'}`;
    return {
      source,
      text: normalized.text.slice(0, PDF_INSPECTION_TEXT_LIMIT),
      pageCount: normalized.pageCount,
      extractedChars: normalized.textChars,
      truncated: normalized.textChars > PDF_INSPECTION_TEXT_LIMIT,
      limitations: normalized.limitations,
    };
  } finally {
    // The source document is intentionally ephemeral, including on extractor errors.
    await rm(directory, { recursive: true, force: true });
  }
}

async function readBoundedRequest(request: Request, maxBytes: number): Promise<Buffer> {
  if (!request.body) throw new PdfUploadError(400, 'Upload body is empty.');
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PdfUploadError(413, 'PDF upload exceeds the 5 MB limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function runPdfInspector(filePath: string): Promise<unknown> {
  const scriptPath = resolveInspectorPath();
  const executable = process.env.PDF_PYTHON?.trim() || (process.platform === 'win32' ? 'python' : 'python3');
  const output = await new Promise<string>((resolveOutput, rejectOutput) => {
    execFile(executable, [scriptPath, filePath], {
      encoding: 'utf8',
      timeout: INSPECTOR_TIMEOUT_MS,
      maxBuffer: INSPECTOR_OUTPUT_LIMIT_BYTES,
      windowsHide: true,
      shell: false,
    }, (error, stdout) => {
      if (error) {
        rejectOutput(new PdfUploadError(422, 'PDF extraction failed. Encrypted, oversized, or unsupported PDFs are rejected.'));
        return;
      }
      resolveOutput(stdout);
    });
  });

  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new PdfUploadError(502, 'PDF extractor returned an invalid response.');
  }
}

function resolveInspectorPath(): string {
  const candidates = [
    resolve(process.cwd(), 'services/pdf-inspection/inspect_pdf.py'),
    resolve(process.cwd(), '../../services/pdf-inspection/inspect_pdf.py'),
  ];
  const scriptPath = candidates.find(existsSync);
  if (!scriptPath) throw new PdfUploadError(503, 'PDF inspector is not available in this checkout.');
  return scriptPath;
}

function validateExtractedDocument(value: unknown): ExtractedDocument & { text: string } {
  if (!isRecord(value) || !Array.isArray(value.pages) || !Array.isArray(value.limitations)) {
    throw new PdfUploadError(502, 'PDF extractor returned an invalid response.');
  }
  if (value.error) throw new PdfUploadError(422, 'PDF extraction failed. Encrypted, oversized, or unsupported PDFs are rejected.');
  const pageCount = value.pageCount;
  const textChars = value.textChars;
  if (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 0 || pageCount > PDF_MAX_PAGES ||
      typeof textChars !== 'number' || !Number.isInteger(textChars) || textChars < 0 || textChars > PDF_MAX_TEXT_CHARS ||
      value.pages.length !== pageCount) {
    throw new PdfUploadError(422, 'PDF exceeds the 20 page or 100,000 extracted character limit.');
  }
  const pages: Array<{ page: number; text: string }> = [];
  for (const page of value.pages) {
    if (!isRecord(page) || !Number.isInteger(page.page) || typeof page.text !== 'string') {
      throw new PdfUploadError(502, 'PDF extractor returned an invalid page.');
    }
    pages.push({ page: page.page as number, text: page.text });
  }
  const text = pages.map((page) => page.text).join('\n');
  const extractedCharacterCount = pages.reduce((count, page) => count + page.text.length, 0);
  if (extractedCharacterCount > PDF_MAX_TEXT_CHARS || extractedCharacterCount !== textChars) {
    throw new PdfUploadError(502, 'PDF extractor returned inconsistent text limits.');
  }
  return {
    pages,
    pageCount: pageCount as number,
    textChars: textChars as number,
    limitations: value.limitations.filter((limitation): limitation is string => typeof limitation === 'string').slice(0, 10),
    text,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
