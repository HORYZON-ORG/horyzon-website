import { BACKEND_VERSION, RadarBackendError, type RadarRpc } from './contracts.ts';

/** Server-only, loopback-only RPC transport. This phase cannot bind a remote Supabase project. */
export class LocalSupabaseRadarRpc implements RadarRpc {
  private readonly url: string;
  private readonly key: string;
  private readonly functionName: 'patrimonial_radar_command'|'patrimonial_foundation_command';
  constructor(config: { url: string; serverKey: string; fetchImpl?: typeof fetch; functionName?: 'patrimonial_radar_command'|'patrimonial_foundation_command' }) {
    if (typeof window !== 'undefined') throw new RadarBackendError('UNAVAILABLE');
    let url: URL;
    try { url = new URL(config.url); } catch { throw new RadarBackendError('UNAVAILABLE'); }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !config.serverKey?.trim() || /^sb_publishable_/i.test(config.serverKey)) throw new RadarBackendError('UNAVAILABLE');
    this.url = url.origin; this.key = config.serverKey;this.functionName=config.functionName??'patrimonial_radar_command';
    this.fetchImpl = config.fetchImpl ?? fetch;
  }
  private readonly fetchImpl: typeof fetch;
  async invoke<T>(command: Readonly<Record<string, unknown>>): Promise<T> {
    try {
      const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${this.functionName}`, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
        headers: { apikey: this.key, ...(!this.key.startsWith('sb_') ? { Authorization: `Bearer ${this.key}` } : {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_command: { ...command, contract: this.functionName==='patrimonial_radar_command'?BACKEND_VERSION:'patrimonial-foundation-5a-1' } }),
      });
      if (!response.ok) throw new RadarBackendError('UNAVAILABLE');
      return unwrap<T>(await response.json());
    } catch (error) {
      if (error instanceof RadarBackendError) throw error;
      // Never include provider bodies, command values or raw causes in errors/logs.
      throw new RadarBackendError('UNAVAILABLE');
    }
  }
}
export function unwrap<T>(value: unknown): T {
  if (!value || typeof value !== 'object' || !('ok' in value)) throw new RadarBackendError('UNAVAILABLE');
  const reply = value as { ok: boolean; code?: string; data?: T };
  if (!reply.ok) {
    const safe = ['INVALID', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'REPLAY_EXPIRED', 'VERSION_MISMATCH', 'INCOMPLETE'] as const;
    throw new RadarBackendError(safe.find(code => code === reply.code) ?? 'UNAVAILABLE');
  }
  return reply.data as T;
}
