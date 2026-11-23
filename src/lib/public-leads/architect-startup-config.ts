/** Validated media source for the public Startup presentation. */
export function architectStartupVideoUrl(env: Record<string, string | undefined>): string {
  const configured = env.ARCHITECT_STARTUP_VIDEO_URL?.trim() ?? '';
  if (/^(https:\/\/[^\s]+\.mp4(?:\?[^\s]*)?|\/[^\s?#]+\.mp4)$/.test(configured)) return configured;

  // Google Drive public video preview (not a raw media URL). Only the fixed
  // file path is accepted; arbitrary Google URLs are never embedded.
  const googleDrive = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,})\/(?:view|preview)(?:\?[^\s#]*)?$/.exec(configured);
  return googleDrive ? `https://drive.google.com/file/d/${googleDrive[1]}/preview` : '';
}

/** The application can lead to the Startup landing while materials are prepared. */
export const architectStartupEnabled = (env: Record<string, string | undefined>) =>
  env.PATRIMONIAL_ARCHITECT_STARTUP_ENABLED === 'true';

/** Explicit contact-interest confirmation is available only with a configured video. */
export const architectStartupConfirmationEnabled = (env: Record<string, string | undefined>) =>
  architectStartupEnabled(env) && Boolean(architectStartupVideoUrl(env));
