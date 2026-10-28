import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
import {assertSourcesAt,assertAssetsAt,MAIN_BASELINE} from './lib/patrimonial-integration-baselines.mjs';
import {radarSteps} from '../src/lib/radar/domain.ts';
const base='33724abcfc04ebf6b073f14cf5039948a83a4cb4';
assertSourcesAt(MAIN_BASELINE,['src/lib/radar','src/components/radar']);
// The enterprise verifier below remains authoritative for the v4 route and 34 steps.
await import('./verify-radar-positioning.mjs');
assert.equal(radarSteps().length,34);
const assets=assertAssetsAt(base,['public/benessere-patrimoniale']).filter(p=>/\.(jpg|jpeg|png|webp)$/.test(p));assert.equal(assets.length,35);
const paths=['src/lib/patrimonial-radar','src/components/radar','src/lib/radar','src/lib/public-leads','supabase','public'];
assertPublicPilotPreservation(base,paths);
const probe='supabase/migrations/20261020134559_patrimonial_radar_hub_foundation.sql',bytes=fs.readFileSync(probe);
try{fs.appendFileSync(probe,'\n-- unreviewed change\n');assert.throws(()=>assertPublicPilotPreservation(base,paths));}finally{fs.writeFileSync(probe,bytes);}
console.log('PASS 5A preservation: enterprise v4 source, 35 current photos (33 historical + 2 current recruitment replacements), deterministic engine, reviewed additive integration pinned, forbidden migration mutation rejected');
