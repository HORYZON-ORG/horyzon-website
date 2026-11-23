import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
const VIDEO_PATH = 'startup/horyzon-startup-full-hd.mp4';

/**
 * Temporary, narrowly-scoped large-file migration endpoint.
 * Delete after the one-off transfer: never accept an anonymous upload.
 */
export async function POST(request: Request) {
  const expected = process.env.ARCHITECT_VIDEO_UPLOAD_SECRET;
  if (!expected || !process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: 'Unavailable' }, { status: 503 });

  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json({ error: 'Invalid content type' }, { status: 415 });

  let body: HandleUploadBody;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return Response.json({ error: 'Too large' }, { status: 413 });
    body = JSON.parse(raw) as HandleUploadBody;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        const supplied = typeof clientPayload === 'string' ? Buffer.from(clientPayload) : Buffer.alloc(0);
        const secret = Buffer.from(expected);
        if (!multipart || pathname !== VIDEO_PATH || supplied.length !== secret.length ||
          !timingSafeEqual(supplied, secret))
          throw new Error('Not authorized');

        return {
          allowedContentTypes: ['video/mp4'],
          maximumSizeInBytes: 450_000_000,
          addRandomSuffix: false,
          tokenPayload: 'horyzon-startup-approved-video',
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (blob.pathname !== VIDEO_PATH || tokenPayload !== 'horyzon-startup-approved-video')
          throw new Error('Unexpected upload callback');
        // The publication URL is validated separately before configuring the player.
      },
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Upload not authorized or failed' }, { status: 403 });
  }
}
