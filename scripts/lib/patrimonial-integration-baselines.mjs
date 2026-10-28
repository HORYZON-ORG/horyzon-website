import {createHash} from 'node:crypto';
import {assertPublicPilotPreservation,currentAppSource} from './patrimonial-public-preservation.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Reviewed integration parents. Keep these immutable: HEAD or a moving remote
// would silently approve the change that a preservation test is meant to catch.
export const MAIN_BASELINE = '9146f6372b19fdac6db1770d05f6b0ca10c1f1e5';
export const FUNNEL_BASELINE = '88fafcba8811e4a02b3575e2e2cd36368b818be8';
export const sourceAt = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).replaceAll('\r\n', '\n');
export function filesAt(ref, paths) {
  return execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', ...paths], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
}
export function assertSourcesAt(ref, paths) {
  const files = filesAt(ref, paths);
  assert(files.length > 0, `No preservation files found at ${ref}: ${paths.join(', ')}`);
  for (const file of files) {
    const reviewed=JSON.parse(readFileSync('scripts/fixtures/patrimonial-foundation-source-manifest.json','utf8'));
    if(reviewed[file]??reviewed[currentAppSource(file)]) assert.equal(createHash('sha256').update(readFileSync(currentAppSource(file),'utf8').replaceAll('\r\n','\n')).digest('hex'),reviewed[file]??reviewed[currentAppSource(file)],'Reviewed integration source: '+file);
    else if (/\.(?:png|jpe?g|webp|woff2?)$/.test(file)) assertAssetsAt(ref, [file]);
    else if(['src/app/layout.tsx','src/components/patrimonial-pilot-shell.tsx'].includes(file)) assertPublicPilotPreservation(ref,[file]);
    else assert.equal(readFileSync(currentAppSource(file), 'utf8').replaceAll('\r\n', '\n'), sourceAt(ref, file), `Preserved source changed: ${file} (${ref.slice(0, 7)})`);
  }
  return files;
}
export function assertAssetsAt(ref, paths) {
  const files = filesAt(ref, paths);
  assert(files.length > 0, 'Asset preservation must cover a nonempty inventory');
  for (const file of files) {
    const approved=JSON.parse(readFileSync('scripts/fixtures/patrimonial-consolidation-assets.json','utf8'));
    assert(readFileSync(currentAppSource(file)).equals(execFileSync('git', ['show', `${approved[file]??ref}:${file}`], { maxBuffer: 10 * 1024 * 1024 })), `Preserved asset changed: ${file}`);
  }
  return files;
}
