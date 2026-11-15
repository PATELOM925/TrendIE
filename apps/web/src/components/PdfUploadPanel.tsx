'use client';

import { useState, type FormEvent } from 'react';
import type { DecisionView, IntentView, ProposalView } from '@/lib/types';

type Finding = { code: string; excerpt: string };
type PdfInspectionView = {
  source: string;
  text: string;
  pageCount: number;
  extractedChars: number;
  truncated: boolean;
  limitations: string[];
};
type VerificationView = {
  decision: DecisionView;
  inspection: {
    source: string;
    findings: Finding[];
    truncated: boolean;
    sourceChars: number;
    caveat: string;
  };
};

export type PdfUploadResult = {
  proposal: ProposalView;
  inspectionText: { source: string; text: string };
  extraction: PdfInspectionView;
  verification: VerificationView;
  verificationTextTruncated: boolean;
};

type PdfUploadPanelProps = {
  intent: IntentView;
  disabled?: boolean;
  onVerified: (result: PdfUploadResult) => void;
};

export function PdfUploadPanel({ intent, disabled = false, onVerified }: PdfUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PdfUploadResult | null>(null);

  async function inspectAndVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!file) {
      setError('Choose a PDF invoice first.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const uploadResponse = await fetch('/api/pdf', { method: 'POST', body: form, cache: 'no-store' });
      const uploadBody = await uploadResponse.json() as { inspection?: PdfInspectionView; error?: string };
      if (!uploadResponse.ok || !uploadBody.inspection) {
        throw new Error(uploadBody.error ?? 'PDF inspection failed.');
      }

      const proposal: ProposalView = {
        intentId: intent.id,
        seller: intent.seller,
        product: intent.product,
        amount: intent.maxAmount,
        currency: intent.currency,
        destination: intent.allowedDestinations[0] ?? 'demo-destination-missing',
        sourceRef: uploadBody.inspection.source,
      };
      const inspectionText = {
        source: uploadBody.inspection.source,
        text: fitVerificationText(proposal, uploadBody.inspection.source, uploadBody.inspection.text),
      };
      const verificationTextTruncated = inspectionText.text.length < uploadBody.inspection.text.length;
      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proposal, inspectionText }),
        cache: 'no-store',
      });
      const verifyBody = await verifyResponse.json() as VerificationView & { error?: string };
      if (!verifyResponse.ok || !verifyBody.decision || !verifyBody.inspection) {
        throw new Error(verifyBody.error ?? 'Gateway decision could not be confirmed. No payment was attempted.');
      }
      const completed: PdfUploadResult = {
        proposal,
        inspectionText,
        extraction: uploadBody.inspection,
        verification: { decision: verifyBody.decision, inspection: verifyBody.inspection },
        verificationTextTruncated,
      };
      setResult(completed);
      onVerified(completed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'PDF verification is unconfirmed. No payment was attempted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pdf-upload panel" aria-labelledby="pdf-upload-title">
      <div className="pdf-upload-heading">
        <div>
          <h2 id="pdf-upload-title">Inspect a PDF invoice</h2>
          <p>Text-layer extraction only. The PDF is removed after inspection. The gateway checks the selected authorization’s exact terms; invoice amounts are not inferred and no payment is submitted.</p>
        </div>
        <span className="pdf-local-pill">Local inspection</span>
      </div>
      <form className="pdf-upload-form" onSubmit={(event) => void inspectAndVerify(event)}>
        <label className="pdf-file-label" htmlFor="invoice-pdf">Choose invoice PDF</label>
        <input
          id="invoice-pdf"
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled || busy}
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(''); setResult(null); }}
        />
        <p className="form-hint">Maximum 5 MB and 20 pages. Encrypted or unsupported files are rejected.</p>
        <button className="secondary-btn" type="submit" disabled={disabled || busy || !file}>
          {busy ? 'Extracting and checking…' : 'Extract text and verify'}
        </button>
      </form>
      {error && <p className="error-banner pdf-upload-message" role="alert">{error}</p>}
      {result && (
        <div className="pdf-result" aria-live="polite">
          <div className="pdf-result-meta">
            <strong>{result.extraction.source.replace('uploaded-pdf:', '')}</strong>
            <span>{result.extraction.pageCount} page(s) · {result.extraction.extractedChars.toLocaleString()} extracted characters</span>
            <span>Gateway decision: {result.verification.decision.decision}</span>
          </div>
          {(result.extraction.truncated || result.verificationTextTruncated) && <p className="evidence-foot">The extracted text was truncated to fit the scanner request limits. No invoice amount or recipient was inferred from the PDF.</p>}
          {result.verification.inspection.findings.length > 0 && (
            <ul className="finding-list">{result.verification.inspection.findings.map((finding, index) => <li key={`${finding.code}-${index}`}><code>{finding.code}</code> — {finding.excerpt}</li>)}</ul>
          )}
          <details>
            <summary>View extracted text and limitations</summary>
            <pre className="evidence-text">{result.extraction.text || 'No text was found in this PDF.'}</pre>
            <ul className="pdf-limitations">{result.extraction.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            <p className="evidence-foot">{result.verification.inspection.caveat}</p>
          </details>
        </div>
      )}
    </section>
  );
}

function fitVerificationText(proposal: ProposalView, source: string, text: string): string {
  const codePoints = Array.from(text);
  let low = 0;
  let high = codePoints.length;
  let best = 0;
  const encoder = new TextEncoder();
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = codePoints.slice(0, middle).join('');
    const body = JSON.stringify({ proposal, inspectionText: { source, text: candidate } });
    if (encoder.encode(body).byteLength <= 60 * 1024) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return codePoints.slice(0, best).join('');
}
