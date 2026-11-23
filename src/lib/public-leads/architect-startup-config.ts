/** Central, server-side video readiness guard for the public candidate hand-off. */
export function architectStartupVideoUrl(env: Record<string, string | undefined>): string {
  const configured = env.ARCHITECT_STARTUP_VIDEO_URL?.trim() ?? '';
  // No third-party iframe whose completion cannot be verified through a media ended event.
  return /^(https:\/\/[^\s]+\.mp4(?:\?[^\s]*)?|\/[^\s?#]+\.mp4)$/.test(configured)
    ? configured : '';
}
/** The application can lead to the startup landing while video materials are being prepared. */
export const architectStartupEnabled = (env: Record<string, string | undefined>) =>
  env.PATRIMONIAL_ARCHITECT_STARTUP_ENABLED === 'true';

/** Only the real video can unlock the final interest confirmation. */
export const architectStartupConfirmationEnabled = (env: Record<string, string | undefined>) =>
  architectStartupEnabled(env) && Boolean(architectStartupVideoUrl(env));
