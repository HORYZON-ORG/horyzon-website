/** Strictly necessary resume cookie: no marketing, no candidate ID or PII. */
export const ARCHITECT_STARTUP_RESUME_COOKIE = process.env.NODE_ENV === 'development'
  ? 'hz_architect_startup'
  : '__Host-hz_architect_startup';

export const ARCHITECT_STARTUP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function architectStartupResumeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };
}
