import assert from 'node:assert/strict';
import { videoUrlFromResult } from '../index.ts';

assert.equal(
  videoUrlFromResult({ status: 'completed', video: { url: 'https://cdn.example/video.mp4' } }),
  'https://cdn.example/video.mp4',
  'completed generation must return its video URL',
);

for (const status of ['failed', 'canceled', 'nsfw', 'moderated']) {
  assert.throws(
    () => videoUrlFromResult({ status }),
    error => error instanceof Error && error.message.toLowerCase().includes(status === 'nsfw' ? 'moderated' : status),
    `${status} generation must not be reported as successful`,
  );
}

assert.throws(
  () => videoUrlFromResult({ status: 'completed' }),
  /without a video url/i,
  'completed generation without an output URL must fail closed',
);

console.log('Higgsfield Seedance result checks passed.');
