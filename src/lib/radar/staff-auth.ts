// Hub staff reaching the Website APIs: the Hub sends its Supabase session token, the Website checks it with Supabase
// Auth and reads the role from hub.user_roles, the same rule as the Hub RLS on radar_assessments (hub.is_superadmin()).
import { RadarAccessError } from './service.ts';

export const DEFAULT_STAFF_ORIGINS = ['https://hub.horyzon.it'];

export function staffOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const configured = env.RADAR_STAFF_ORIGINS?.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
  return configured?.length ? configured : DEFAULT_STAFF_ORIGINS;
}

export function bearerToken(authorization: string | null): string {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) throw new RadarAccessError('Accesso riservato allo staff Horyzon.', 401);
  return match[1];
}

export async function verifyRadarStaff(accessToken: string, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim().replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) throw new RadarAccessError('Accesso staff non configurato.', 503);

  const userResponse = await fetchImpl(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` } });
  if (!userResponse.ok) throw new RadarAccessError('Sessione Hub non valida: accedi di nuovo.', 401);
  const user = await userResponse.json() as { id?: unknown };
  if (typeof user.id !== 'string' || !user.id) throw new RadarAccessError('Sessione Hub non valida: accedi di nuovo.', 401);

  const roleResponse = await fetchImpl(`${url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(user.id)}&role=eq.superadmin&select=user_id`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Accept-Profile': 'hub' } });
  if (!roleResponse.ok) throw new Error(`Radar staff role lookup failed: ${roleResponse.status}`);
  const roles = await roleResponse.json() as unknown[];
  if (!Array.isArray(roles) || roles.length === 0) throw new RadarAccessError('Accesso riservato allo staff Horyzon.', 403);
  return user.id;
}
