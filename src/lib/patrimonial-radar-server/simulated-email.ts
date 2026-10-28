import { RadarBackendError, type SimulatedEmailProvider } from './contracts.ts';

/** Test-only loopback sink. It cannot deliver mail and has no browser inbox endpoint. */
export function localSimulatedEmail(urlInput: string, key: string): SimulatedEmailProvider {
  let url: URL;
  try { url = new URL(urlInput); } catch { throw new RadarBackendError('UNAVAILABLE'); }
  if (typeof window !== 'undefined' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.pathname !== '/simulated-email' || url.search || url.hash || url.username || url.password || !key) throw new RadarBackendError('UNAVAILABLE');
  return { kind: 'SIMULATED', async sendCode(input) {
    if (!input.email.endsWith('.invalid')) throw new RadarBackendError('UNAVAILABLE');
    try {
      const response = await fetch(url, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', apikey: key }, body: JSON.stringify(input) });
      if (!response.ok) throw new RadarBackendError('UNAVAILABLE');
    } catch { throw new RadarBackendError('UNAVAILABLE'); }
  } };
}
