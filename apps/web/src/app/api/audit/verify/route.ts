import {
  callGateway,
  jsonResponse,
} from '@/lib/gateway-server';

export async function GET(): Promise<Response> {
  try {
    const result = await callGateway('admin', '/audit/chain/verify');
    if (!result.ok) {
      return jsonResponse({ error: 'Gateway audit verification failed.' }, result.status);
    }
    return jsonResponse(result.data);
  } catch {
    return jsonResponse({ error: 'Audit verification unavailable.' }, 503);
  }
}
