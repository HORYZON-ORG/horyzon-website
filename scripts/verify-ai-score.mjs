import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const methodology = readFileSync(join(root, 'src/lib/ai-score/methodology.ts'), 'utf8');
const audit = readFileSync(join(root, 'src/lib/ai-score/audit.ts'), 'utf8');
const ssrf = readFileSync(join(root, 'src/lib/ai-score/ssrf.ts'), 'utf8');
const providers = readFileSync(join(root, 'src/lib/ai-score/providers.ts'), 'utf8');

const categoryWeights = [...methodology.matchAll(/weight: (\d+), description/g)].map((match) => Number(match[1]));
assert.equal(categoryWeights.reduce((sum, weight) => sum + weight, 0), 100, 'Readiness category weights must total 100');

const checkDefinitions = [...methodology.matchAll(/def\('[^']+', '([^']+)'/g)].map((match) => match[1]);
assert.ok(checkDefinitions.length >= 60 && checkDefinitions.length <= 80, `Expected 60-80 check definitions, found ${checkDefinitions.length}`);
assert.equal(new Set(checkDefinitions).size, checkDefinitions.length, 'Check ids must be unique');

assert.match(methodology, /checksCoverage \* 0\.28/, 'Confidence formula must include check coverage');
assert.match(methodology, /visibilityCoverage \* 0\.08/, 'Confidence formula must include visibility coverage');
assert.match(methodology, /externalCoverage \* 0\.08/, 'Confidence formula must include external footprint coverage');
assert.match(providers, /state: 'not_measured'/, 'No-op providers must return not_measured');
assert.match(providers, /score: null/, 'AI Visibility no-op provider must not invent a score');
assert.match(audit, /state: 'not_calculated'/, 'Potential score must remain not_calculated without verified remediation simulation');
assert.doesNotMatch(audit, /remediationSummary\.length \* 2/, 'Old fake potential score heuristic must not return');

for (const blocked of ['a === 10', 'a === 127', 'a === 169 && b === 254', 'address === METADATA_IP', "address === '::1'", "address.startsWith('fc')"]) {
  assert.ok(ssrf.includes(blocked), `SSRF guard missing ${blocked}`);
}
assert.match(ssrf, /lookup: NonNullable<RequestOptions\['lookup'\]>/, 'Fetcher must use pinned DNS lookup');
assert.match(ssrf, /socket\.remoteAddress/, 'Fetcher must validate remote socket address');
assert.match(audit, /classifyPageType\('https:\/\/example\.com\/chi-siamo'|classifyPageType\(url: string/, 'Page classification must be exposed');

console.log('AI Score verifier passed');
