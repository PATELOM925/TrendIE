import { extractPdfUpload, PdfUploadError } from '@/lib/pdf-inspector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const inspection = await extractPdfUpload(request);
    return Response.json({ inspection }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof PdfUploadError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { 'cache-control': 'no-store' } });
    }
    return Response.json({ error: 'PDF extraction is unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
