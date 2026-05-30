import type { ServerNetworkInfo } from './network-config';
import { getApiUrl } from './config';

export async function fetchNetworkInfo(): Promise<ServerNetworkInfo | null> {
  try {
    const res = await fetch(`${getApiUrl()}/network/info`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function testNetworkConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = performance.now();
  try {
    const res = await fetch(`${getApiUrl()}/network/ping`);
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    return { ok: true, latencyMs };
  } catch {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: 'Sin respuesta del servidor',
    };
  }
}
