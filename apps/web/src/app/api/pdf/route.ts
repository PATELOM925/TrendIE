import { extractPdfUpload, PdfUploadError } from '@/lib/pdf-inspector';
import { VerificationRequestError, getOwnedIntent, verificationErrorResponse, verifyProposalWithGateway } from '@/lib/gateway-verification';
import { fitPdfInspectionText } from '@/lib/pdf-inspector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const extraction = await extractPdfUpload(request);
    const intent = await getOwnedIntent(extraction.intentId);
    const destination = intent.allowedDestinations[0];
    if (!destination) throw new VerificationRequestError(409, 'This authorization has no allowed destination; no proposal was submitted.');

    const proposal = {
      intentId: intent.id,
      seller: intent.seller,
      product: intent.product,
      amount: intent.maxAmount,
      currency: intent.currency,
      destination,
      sourceRef: extraction.source,
    };
    const fittedText = fitPdfInspectionText(proposal, extraction.source, extraction.text);
    const inspectionText = { source: extraction.source, text: fittedText.text };
    const verification = await verifyProposalWithGateway(proposal, inspectionText, {
      truncated: extraction.truncated || fittedText.truncated,
      sourceChars: extraction.extractedChars,
    });
    return Response.json({
      proposal,
      inspectionText,
      extraction,
      verification,
      verificationTextTruncated: fittedText.truncated,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof PdfUploadError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { 'cache-control': 'no-store' } });
    }
    return verificationErrorResponse(error);
  }
}
