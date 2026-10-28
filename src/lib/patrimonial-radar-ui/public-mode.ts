import {protectedRemoteConfigured} from '../patrimonial-radar-server/remote-config.ts';
import {accountConfig} from '../patrimonial-radar-server/account-config.ts';
/** Server configuration only. Never accepts URL, cookie or NEXT_PUBLIC flags. */
export function patrimonialRadarMode(env: Readonly<Record<string,string|undefined>>): 'PUBLIC_ANONYMOUS'|'VERIFIED_PERSISTENT'|null {
  // Same native gate as the page/API; no fallback to the historical broker path.
  if(env.PATRIMONIAL_RADAR_ACCOUNT_ENABLED==='true') {
    try{return accountConfig(env)?'VERIFIED_PERSISTENT':null;}catch{return null;}
  }
  const anonymous=env.PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED==='true';
  const persistent=env.PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED==='true';
  if(anonymous&&persistent) return null;
  // 5A product decision: the immutable 4P Preview is historical. The final
  // product has one identified route; legacy anonymous flags cannot open it.
  if(env.PATRIMONIAL_RADAR_MODE==='PUBLIC_ANONYMOUS') return null;
  if(protectedRemoteConfigured(env))return 'VERIFIED_PERSISTENT';
  if(env.PATRIMONIAL_RADAR_MODE==='VERIFIED_PERSISTENT'&&persistent&&!anonymous&&!env.VERCEL&&env.VERCEL_ENV!=='production') return 'VERIFIED_PERSISTENT';
  return null;
}
