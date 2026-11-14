# Hackathon facts and unknowns

Checked 2026-11-14 from public organizer/sponsor sources and the evidence described below. Do not
publish private messages, account details, credentials, tokens or OTPs here.

## Public event page

The [BuilderBase event page](https://builderbase.com/event/agentic-payments-hackathon-toronto)
lists the event for Nov 13–15, 2026 and the themes Use, Control and Attack. It describes a public
source repository, working prototype, payment flow, security/failure analysis, dependency/license
information and live presentation. It does not require a specific payment stack or sponsor track.
The public page says teams of 2–4; the historical five-role plan in [Division.md](../Division.md)
is retained as a work breakdown, not a verified current team-size rule.

## Sponsor documentation

- [Qatom sponsor guide (PDF)](https://sbnxiexidrjwubdfjepb.supabase.co/storage/v1/object/public/uploads/sponsor-files/c91cfc3f-5c4a-49d2-8e46-d37ca25b6ae3.pdf) documents MCP endpoint `https://mcp.m.todaq.net/mcp`, `catalog_search` and `agent_checkout`, and USD-TDN with three decimal places. Authentication and funded buyer checkout have not been verified in this app. No sandbox or free transaction guarantee is established. Treat retries as potentially new charges unless provider semantics prove otherwise.
- [Qatom capabilities A1, A13, A14 and A28](https://qatom.ai/capabilities#A1) and [Qatom docs](https://docs.qatom.ai) are additional primary references. Exact price binding for a guarded checkout remains unresolved.
- [GOAT AgentKit quick start](https://docs.goat.network/docs/agents/agent-kit/quick-start) documents `@goatnetwork/agentkit` and Testnet3 RPC `https://rpc.testnet3.goat.network`, chain 48816. A future sender must verify `eth_chainId` before dispatch. No chain activity was performed for this docs foundation. A Noop result is not payment proof.

## Organizer and team evidence

Organizer email corrected the event end to Sunday Nov 15 at 5 PM EST; an older 8 PM time is stale.
Saturday is hybrid and Sunday demos are in person. The event end is not the submission cutoff.
Exact cutoff, pitch time and judging rubric remain unknown.

Organizer WhatsApp announcements point to a Canva deck and announce a Qatom workshop Saturday at
about 10:30–11:30 AM at Highline Beta. The deck content was not readable during verification, so
these details are reported as announcements, not full event instructions. Team messages confirm
Om covers Persons 3 and 4 and that Nassar targets a Stage 1 minimum and Stage 2 integration goal;
absolute date/time and timezone for that meeting are unverified.

Authenticated BuilderBase browser access reached a login, but the event route exposed no readable
page content. No dashboard details are claimed. No external messages were sent or accounts changed.
