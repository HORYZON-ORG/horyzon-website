import { pathToFileURL } from 'node:url';
import { config, higgsfield } from '@higgsfield/client/v2';

type HiggsfieldVideoResult = {
 status?: string;
 video?: { url?: string };
};

export function videoUrlFromResult(result: HiggsfieldVideoResult): string {
 const status = result.status?.toLowerCase();

 if (status === 'completed') {
  const url = result.video?.url;
  if (!url) throw new Error('Higgsfield completed without a video URL.');
  return url;
 }

 if (status === 'nsfw' || status === 'moderated') {
  throw new Error('Higgsfield request was moderated.');
 }

 if (status === 'failed') throw new Error('Higgsfield request failed.');
 if (status === 'canceled' || status === 'cancelled') throw new Error('Higgsfield request was canceled.');
 throw new Error(`Higgsfield returned an unexpected terminal status: ${status ?? 'unknown'}.`);
}

async function main() {
 const credentials = process.env.HF_CREDENTIALS;
 if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials)) {
  throw new Error('Set HF_CREDENTIALS in .env.local as KEY_ID:KEY_SECRET before running this example.');
 }

 config({ credentials });
 const result = await higgsfield.subscribe(
  'bytedance/seedance-2.5/text-to-video',
  {
   input: {
    prompt: 'A cinematic scene at sunset',
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
    output_format: 'mp4',
    generate_audio: true,
   },
   withPolling: true,
  },
 );

 console.log(videoUrlFromResult(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Higgsfield request failed with an unknown error.');
  process.exitCode = 1;
 });
}
