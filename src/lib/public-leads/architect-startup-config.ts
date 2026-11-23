/** Validated media source for the public Startup presentation. */
export function architectStartupVideoUrl(env: Record<string, string | undefined>): string {
  const configured = env.ARCHITECT_STARTUP_VIDEO_URL?.trim() ?? '';
  // Browser-native HTML5 player: accept only a direct HTTPS MP4 or a local MP4.
  // Google Drive embeds do not expose a reliable video-ended event.
  return /^(https:\/\/[^\s]+\.mp4(?:\?[^\s]*)?|\/[^\s?#]+\.mp4)$/.test(configured)
    ? configured : '';
}

/** The application can lead to the Startup landing while materials are prepared. */
export const architectStartupEnabled = (env: Record<string, string | undefined>) =>
  env.PATRIMONIAL_ARCHITECT_STARTUP_ENABLED === 'true';

/** Explicit contact-interest confirmation is available only with a configured video. */
export const architectStartupConfirmationEnabled = (env: Record<string, string | undefined>) =>
  architectStartupEnabled(env) && Boolean(architectStartupVideoUrl(env));
