import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

function findKeyframeCount(buffer, start = 0, end = buffer.length) {
  for (let offset = start; offset + 8 <= end;) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (size < 8 || offset + size > end) break;
    if (type === 'stss') return buffer.readUInt32BE(offset + 12);
    if (containers.has(type)) {
      const count = findKeyframeCount(buffer, offset + 8, offset + size);
      if (count !== null) return count;
    }
    offset += size;
  }
  return null;
}

function findSampleCount(buffer, start = 0, end = buffer.length) {
  for (let offset = start; offset + 8 <= end;) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (size < 8 || offset + size > end) break;
    if (type === 'stsz') return buffer.readUInt32BE(offset + 16);
    if (containers.has(type)) {
      const count = findSampleCount(buffer, offset + 8, offset + size);
      if (count !== null) return count;
    }
    offset += size;
  }
  return null;
}

for (const [file, maxBytes] of [['public/journey/horizon-web.mp4', 3_200_000], ['public/journey/horizon-mobile.mp4', 1_800_000]]) {
  const buffer = await readFile(file);
  const keyframes = findKeyframeCount(buffer);
  const samples = findSampleCount(buffer);
  assert(samples !== null && samples >= 140, `${file}: expected a fluid frame sequence, found ${samples}`);
  // MP4 may omit stss when every sample is a sync sample.
  assert(keyframes === null || keyframes === samples, `${file}: every frame must be independently seekable`);
  assert((await stat(file)).size <= maxBytes, `${file}: file is too large for smooth scrubbing`);
}

const component = await readFile('src/components/journey/journey.tsx', 'utf8');
assert(component.includes('horizon-mobile.mp4'), 'Journey must provide a mobile video asset');
assert(component.includes('src={videoSource}'), 'Journey must select one responsive source before rendering the video');
assert(!component.includes('type="video/mp4"'), 'Journey must not trigger transient media errors through competing video source elements');
assert(component.includes('createScrubController'), 'Journey must coalesce scroll targets while the decoder is busy');
console.log('Video scrub checks passed.');
