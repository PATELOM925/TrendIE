export type InspectedPdfPage = { page: number; text: string };

export type InspectedPdf = {
  provenance: 'synthetic-or-user-local-document';
  pages: InspectedPdfPage[];
  pageCount: number;
  textChars: number;
  limitations: string[];
};

export function inspectPdf(options: {
  path: string;
  allowlistedRoot: string;
  python?: string;
  timeoutMs?: number;
}): Promise<InspectedPdf>;
