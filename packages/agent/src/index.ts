import { PurchaseProposalSchema, type PurchaseProposal } from '@trendie/contracts';
import { inspectText, type InspectionResult } from '@trendie/inspection';

export type Listing = { itemId: string; sellerId: string; title: string; amount: string; scale: number; asset: string; description?: string };
export type Discovery = { search(query: string, signal: AbortSignal): Promise<Listing[]> };
export type Model = { propose(input: { task: string; listings: Listing[]; signal: AbortSignal }): Promise<unknown> };
export type TrustedTask = { ownerId: string; intentId: string; intentVersion: number; platform: 'qatom' | 'goat'; chain: string; task: string; maxAmount: string; maxScale: number; asset: string };
export type WorkflowResult = { proposal: PurchaseProposal; inspection: InspectionResult; source: 'scripted' | 'model' };

export type Limits = { timeoutMs?: number; maxListings?: number; maxTextChars?: number; maxTurns?: number; maxToolCalls?: number };
export async function runPurchaseWorkflow(input: { task: TrustedTask; query: string; discovery: Discovery; model: Model; source: 'scripted' | 'model'; limits?: Limits }): Promise<WorkflowResult> {
  const limits = input.limits ?? {};
  const timeoutMs = limits.timeoutMs ?? 5_000;
  const maxListings = limits.maxListings ?? 20;
  if (timeoutMs < 1 || timeoutMs > 30_000 || maxListings < 1 || maxListings > 100 || (limits.maxTurns ?? 1) < 1 || (limits.maxTurns ?? 1) > 4 || (limits.maxToolCalls ?? 1) < 1 || (limits.maxToolCalls ?? 1) > 4) throw new RangeError('Workflow limits exceed supported bounds');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const listings = await Promise.race([input.discovery.search(input.query.slice(0, 500), controller.signal), new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Workflow timed out')), { once: true }))]);
    if (listings.length > maxListings) throw new Error('Discovery result limit exceeded');
    if (Buffer.byteLength(JSON.stringify(listings), 'utf8') > 200_000) throw new RangeError('Discovery payload limit exceeded');
    const raw = await Promise.race([input.model.propose({ task: input.task.task.slice(0, 2_000), listings, signal: controller.signal }), new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Workflow timed out')), { once: true }))]);
    if (controller.signal.aborted) throw new Error('Workflow timed out');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Proposal is not an object');
    const candidate = raw as Record<string, unknown>;
    const untrusted = { ...candidate, ownerId: input.task.ownerId, intentId: input.task.intentId, intentVersion: input.task.intentVersion, platform: input.task.platform, chain: input.task.chain };
    const proposal = PurchaseProposalSchema.parse(untrusted);
    if (proposal.asset !== input.task.asset || proposal.money.scale !== input.task.maxScale || BigInt(proposal.money.amount) > BigInt(input.task.maxAmount)) throw new Error('Proposal exceeds trusted task constraints');
    const selected = listings.find((entry) => entry.itemId === proposal.itemId && entry.sellerId === proposal.sellerId);
    if (!selected || selected.amount !== proposal.money.amount || selected.asset !== proposal.asset || selected.scale !== proposal.money.scale) throw new Error('Proposal does not match discovered listing');
    const text = listings.map((item) => `${item.title}\n${item.description ?? ''}`).join('\n').slice(0, limits.maxTextChars ?? 100_000);
    return { proposal, inspection: inspectText(text, limits.maxTextChars ?? 100_000), source: input.source };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Workflow timed out');
    if (error instanceof TypeError && /Proposal/.test(error.message)) throw error;
    throw new Error(error instanceof RangeError ? 'Workflow resource limit exceeded' : 'Workflow failed');
  } finally { clearTimeout(timer); }
}
