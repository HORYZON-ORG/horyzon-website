/** Central, server-side video readiness guard for the public candidate hand-off. */
export function architectStartupVideoUrl(env: Record<string, string | undefined>): string {
  const configured = env.ARCHITECT_STARTUP_VIDEO_URL?.trim() ?? '';
  // No third-party iframe whose completion cannot be verified through a media ended event.
  return /^(https:\/\/[^\s]+\.mp4(?:\?[^\s]*)?|\/[^\s?#]+\.mp4)$/.test(configured)
    ? configured : '';
}
export const architectStartupEnabled = (env: Record<string, string | undefined>) =>
  env.PATRIMONIAL_ARCHITECT_STARTUP_ENABLED === 'true' &&
  Boolean(architectStartupVideoUrl(env));
