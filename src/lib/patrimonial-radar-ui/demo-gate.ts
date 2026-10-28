/** Deliberately local only. Never infer authorization from a URL or public variable. */
export function patrimonialRadarDemoEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.PATRIMONIAL_RADAR_DEMO_ENABLED === 'true'
    && env.PATRIMONIAL_RADAR_DEMO_CONTEXT === 'local-test'
    && !env.VERCEL && env.VERCEL_ENV !== 'production';
}
