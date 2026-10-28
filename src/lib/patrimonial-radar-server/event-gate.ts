import { PATRIMONIAL_V2 } from '../public-leads/patrimonial-contract.ts';
import { backendLocalTestEnabled } from './runtime.ts';
import {protectedRemoteConfigured} from './remote-config.ts';
import {accountConfig} from './account-config.ts';

/** Server-only, reversible opt-in for the real Event landing. Never inferred
 * from a public flag, URL or cookie; recruitment retains its existing contract. */
export function localEventRadarContract(env: Readonly<Record<string, string | undefined>>) {
  if (env.PATRIMONIAL_RADAR_ACCOUNT_ENABLED === 'true') {
    try { const account=accountConfig(env);return env.PATRIMONIAL_V2_ENABLED === 'true' && env.HORYZON_HUB_EVENT_INGRESS_ENABLED === 'true' && account && !account.beta ? PATRIMONIAL_V2 : undefined; }
    catch { return undefined; }
  }
  if(protectedRemoteConfigured(env)&&env.PATRIMONIAL_EVENT_RADAR_CONTEXT==='protected-remote'&&env.PATRIMONIAL_V2_ENABLED==='true')return PATRIMONIAL_V2;
  return backendLocalTestEnabled(env)
    && env.PATRIMONIAL_RADAR_FOUNDATION_CONTEXT === 'local-test'
    && env.PATRIMONIAL_EVENT_RADAR_CONTEXT === 'local-test'
    && env.PATRIMONIAL_V2_ENABLED === 'true'
    ? PATRIMONIAL_V2 : undefined;
}
