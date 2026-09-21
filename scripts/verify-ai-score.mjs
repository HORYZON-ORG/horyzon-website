import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const methodology = readFileSync(join(root, 'src/lib/ai-score/methodology.ts'), 'utf8');
const audit = readFileSync(join(root, 'src/lib/ai-score/audit.ts'), 'utf8');
const ssrf = readFileSync(join(root, 'src/lib/ai-score/ssrf.ts'), 'utf8');
const providers = readFileSync(join(root, 'src/lib/ai-score/providers.ts'), 'utf8');
const visibility = readFileSync(join(root, 'src/lib/ai-score/visibility.ts'), 'utf8');
const externalFootprint = readFileSync(join(root, 'src/lib/ai-score/external-footprint.ts'), 'utf8');
const types = readFileSync(join(root, 'src/lib/ai-score/types.ts'), 'utf8');
const client = readFileSync(join(root, 'src/components/ai-score-client.tsx'), 'utf8');
const methodologyPage = readFileSync(join(root, 'src/app/ai-score/methodology/page.tsx'), 'utf8');

const categoryWeights = [...methodology.matchAll(/weight: (\d+), description/g)].map((match) => Number(match[1]));
assert.equal(categoryWeights.reduce((sum, weight) => sum + weight, 0), 100, 'Readiness category weights must total 100');

const checkDefinitions = [...methodology.matchAll(/def\('[^']+', '([^']+)'/g)].map((match) => match[1]);
assert.ok(checkDefinitions.length >= 60 && checkDefinitions.length <= 80, `Expected 60-80 check definitions, found ${checkDefinitions.length}`);
assert.equal(new Set(checkDefinitions).size, checkDefinitions.length, 'Check ids must be unique');

assert.match(types, /export type CheckWeightClass = 'CRITICAL' \| 'HIGH' \| 'MEDIUM' \| 'LOW'/, 'Check weight classes must be typed');
assert.match(methodology, /CRITICAL: 4[\s\S]*HIGH: 3[\s\S]*MEDIUM: 2[\s\S]*LOW: 1/, 'Critical checks must weigh more than low signals');
assert.match(methodology, /llms_txt_minor_signal', 'llms\.txt rilevato come segnale minore', 'LOW'/, 'llms.txt must remain a low-weight minor signal');
assert.match(methodology, /calculateReadinessCoverage/, 'Readiness coverage must be calculated separately from score');
assert.match(methodology, /readinessCoverageLabel/, 'Readiness coverage must expose a public label');

assert.match(methodology, /checksCoverage \* 0\.28/, 'Confidence formula must include check coverage');
assert.match(methodology, /visibilityCoverage \* 0\.08/, 'Confidence formula must include visibility coverage');
assert.match(methodology, /externalCoverage \* 0\.08/, 'Confidence formula must include external footprint coverage');
assert.match(methodology, /providerGapCap = visibilityCoverage === 0 && externalCoverage === 0 \? 79 : 100/, 'Confidence must not be HIGH when both external providers are missing');
assert.match(methodology, /AI_EXTERNAL_FOOTPRINT_METHODOLOGY_VERSION = 'horyzon-external-footprint-v1'/, 'External Footprint methodology must be versioned');
assert.match(methodology, /externalPresence: 25[\s\S]*independentSourceCoverage: 30[\s\S]*entityConsistency: 20[\s\S]*categoryExpertiseAssociation: 15[\s\S]*sourceDiversity: 10/, 'External Footprint weights must total the documented five metrics');
assert.doesNotMatch(methodology, /Microsoft Bing Web Search API/, 'Legacy Bing Web Search API must not remain in methodology references');

assert.match(visibility, /VisibilityScanProfileId = 'FREE_QUICK_SCAN' \| 'PREMIUM_COMPREHENSIVE'/, 'Visibility scan profiles must be typed');
assert.match(visibility, /promptCount: 5/, 'FREE quick scan must be limited to 5 prompts');
assert.match(visibility, /providerIds: \['openai_web_search'\]/, 'FREE quick scan must plan one provider');
assert.match(visibility, /promptCount: 15/, 'Premium profile must plan 15 prompts');
assert.match(visibility, /openai_web_search/, 'OpenAI Web Search adapter must be registered');
assert.match(visibility, /google_search_grounding/, 'Google Search Grounding adapter must be registered');
assert.match(visibility, /perplexity_sonar/, 'Perplexity Sonar adapter must be registered');
assert.doesNotMatch(visibility, /bing_web_search_api/, 'Legacy Bing Web Search API must not be an active provider candidate');
assert.match(visibility, /OPENAI_API_KEY/, 'OpenAI env name must be server-side only');
assert.match(visibility, /GOOGLE_AI_API_KEY/, 'Google env name must be server-side only');
assert.match(visibility, /PERPLEXITY_API_KEY/, 'Perplexity env name must be server-side only');
assert.match(visibility, /generateVisibilityPrompts/, 'Prompt generator must be implemented');
assert.match(visibility, /validateVisibilityPrompt/, 'Prompt validator must be implemented');
assert.match(visibility, /containsPromptInjection/, 'Prompt injection defense must be implemented');
assert.match(visibility, /scoreVisibilityObservations/, 'Visibility scoring must be based on observations');
assert.match(visibility, /calculateVisibilityCoverage/, 'Visibility coverage must be implemented');
assert.match(visibility, /validateVisibilityCostGuard/, 'Cost guard must be implemented');
assert.match(visibility, /NoopVisibilityObservationStore/, 'Production-safe no-op observation store must exist');
assert.match(visibility, /recordVisibilityTelemetry/, 'Safe telemetry hook must exist');
assert.match(visibility, /shareOfVoice: reliableCompetitorMentions > 0 \?/, 'Share of Voice must support N/A');
assert.match(visibility, /crossEngineConsistency: surfaces.size >= 2 \?/, 'Cross-engine consistency must support N/A');
assert.match(visibility, /state: 'not_measured'[\s\S]*score: null[\s\S]*coverage: 0/, 'No-provider behavior must be Not measured with null score and zero coverage');
assert.doesNotMatch(visibility, /Math\.random\(/, 'Visibility must not use random scores');
assert.doesNotMatch(visibility, /hash.*score|score.*hash/i, 'Visibility must not derive score from hashes');
assert.doesNotMatch(visibility, /demo visibility|fallback.*50|score:\s*50/i, 'Visibility must not contain fake fallback scores');
assert.doesNotMatch(visibility, /fixtures\/visibility|test\/fixtures/, 'Production visibility runtime must not import fixtures');

assert.match(externalFootprint, /ExternalFootprintProfileId = 'FREE_EXTERNAL_FOOTPRINT' \| 'PREMIUM_EXTERNAL_FOOTPRINT'/, 'External Footprint profiles must be typed');
assert.match(externalFootprint, /queryCount: 5/, 'FREE External Footprint profile must be limited to 5 queries');
assert.match(externalFootprint, /providerIds: \['perplexity_search'\]/, 'FREE External Footprint must plan Perplexity Search only');
assert.match(externalFootprint, /queryCount: 12/, 'Premium External Footprint profile must plan deeper queries');
assert.match(externalFootprint, /enabled: false/, 'External Footprint profiles must remain disabled by default');
assert.match(externalFootprint, /perplexity_search/, 'Perplexity Search adapter must be registered');
assert.match(externalFootprint, /AI_SCORE_EXTERNAL_FOOTPRINT_LIVE_ENABLED/, 'External Footprint live calls must require a separate server-side flag');
assert.match(externalFootprint, /PERPLEXITY_API_KEY/, 'Perplexity env name must be server-side only');
assert.match(externalFootprint, /generateExternalFootprintQueries/, 'External Footprint query generator must be implemented');
assert.match(externalFootprint, /validateExternalFootprintQuery/, 'External Footprint query validator must be implemented');
assert.match(externalFootprint, /containsSearchInjection/, 'External Footprint search injection defense must be implemented');
assert.match(externalFootprint, /classifyExternalSource/, 'Source classifier must be implemented');
assert.match(externalFootprint, /matchExternalEntity/, 'Entity matcher must be implemented');
assert.match(externalFootprint, /buildExternalFootprintObservations/, 'Observation builder must be implemented');
assert.match(externalFootprint, /scoreExternalFootprintObservations/, 'External Footprint scoring must be implemented');
assert.match(externalFootprint, /calculateExternalFootprintCoverage/, 'External Footprint coverage must be implemented');
assert.match(externalFootprint, /validateExternalFootprintCostGuard/, 'External Footprint cost guard must be implemented');
assert.match(externalFootprint, /NoopExternalFootprintStore/, 'Production-safe no-op footprint store must exist');
assert.match(externalFootprint, /externalFootprintCacheKey/, 'External Footprint cache key must be implemented');
assert.match(externalFootprint, /recordExternalFootprintTelemetry/, 'External Footprint safe telemetry hook must exist');
assert.match(externalFootprint, /classification: 'OWNED'[\s\S]*independent: false/, 'Owned domains must not count as independent sources');
assert.match(externalFootprint, /state: 'not_measured'[\s\S]*score: null[\s\S]*coverage: 0/, 'No-provider footprint behavior must be Not measured with null score and zero coverage');
assert.doesNotMatch(externalFootprint, /Math\.random\(/, 'External Footprint must not use random scores');
assert.doesNotMatch(externalFootprint, /results\.length \*|score:\s*input\.searchResults\.length|raw result count/i, 'External Footprint must not score raw result count directly');
assert.doesNotMatch(externalFootprint, /fixtures\/external-footprint|test\/fixtures/, 'Production external footprint runtime must not import fixtures');

assert.match(providers, /measureAiVisibility/, 'Audit provider must route through visibility infrastructure');
assert.match(providers, /FREE_QUICK_SCAN/, 'Audit provider must use the free quick scan profile');
assert.match(providers, /measureExternalBrandFootprint/, 'Audit provider must route through external footprint infrastructure');
assert.match(providers, /FREE_EXTERNAL_FOOTPRINT/, 'Audit provider must use the free external footprint profile');
assert.doesNotMatch(providers, /bing_web_search_api/, 'Providers module must not expose legacy Bing active adapter');

assert.match(types, /VisibilityObservationStatus = 'SUCCESS' \| 'PARTIAL' \| 'FAILED' \| 'SKIPPED' \| 'NOT_CONFIGURED'/, 'Observation statuses must distinguish failures from absence');
assert.match(types, /interface VisibilitySource/, 'Visibility source model must exist');
assert.match(types, /interface EntityProfile/, 'Entity profile model must exist');
assert.match(types, /officialProfiles\?: EntityProfileField<string\[\]>/, 'Entity profile must support official profiles');
assert.match(types, /interface AiVisibilityProviderAdapter/, 'Vendor-neutral visibility provider adapter interface must exist');
assert.match(types, /interface ExternalFootprintQuery/, 'External Footprint query model must exist');
assert.match(types, /interface ExternalSearchResult/, 'External search result model must exist');
assert.match(types, /interface ExternalFootprintObservation/, 'External Footprint observation model must exist');
assert.match(types, /interface ExternalFootprintProviderAdapter/, 'Vendor-neutral external footprint provider adapter interface must exist');
assert.match(types, /coverage\?: number/, 'Visibility and External Footprint APIs must expose coverage');

assert.match(client, /Analizziamo la presenza del brand su diverse superfici di ricerca AI/, 'Public copy must explain AI Visibility as brand presence across AI search surfaces');
assert.match(client, /Quick scan · \$\{executed\}\/\$\{planned\} query analizzate/, 'FREE UI must be ready to show quick scan coverage');
assert.match(methodologyPage, /Superfici supportate/, 'Methodology page must document supported surfaces');
assert.match(methodologyPage, /Not configured/, 'Methodology page must show providers as not configured by default');
assert.match(methodologyPage, /Bing Search APIs legacy non sono piu usate/, 'Methodology page must document Microsoft cleanup');
assert.match(methodologyPage, /External Brand Footprint/, 'Methodology page must explain External Brand Footprint');
assert.match(methodologyPage, /quantita di risultati non equivale automaticamente ad autorevolezza/, 'Methodology page must reject raw result-count authority');
assert.match(methodologyPage, /Perplexity Search API/, 'Methodology page must show Perplexity Search provider candidate');
assert.match(methodologyPage, /FREE_EXTERNAL_FOOTPRINT/, 'Methodology page must document the free external footprint profile');

const visibilityFixtureDir = join(root, 'test/fixtures/visibility');
assert.ok(existsSync(visibilityFixtureDir), 'Visibility fixtures directory must exist');
const visibilityFixtureNames = readdirSync(visibilityFixtureDir).filter((file) => file.endsWith('.json'));
for (const fixture of ['brand-mentioned-cited.json', 'brand-mentioned-not-cited.json', 'brand-absent.json', 'provider-failure.json', 'multiple-surfaces.json']) {
  assert.ok(visibilityFixtureNames.includes(fixture), `Missing visibility fixture ${fixture}`);
  const fixtureContent = readFileSync(join(visibilityFixtureDir, fixture), 'utf8');
  assert.match(fixtureContent, /"testOnly": true/, `Fixture ${fixture} must be marked testOnly`);
}

const footprintFixtureDir = join(root, 'test/fixtures/external-footprint');
assert.ok(existsSync(footprintFixtureDir), 'External Footprint fixtures directory must exist');
const footprintFixtureNames = readdirSync(footprintFixtureDir).filter((file) => file.endsWith('.json'));
for (const fixture of ['owned-result.json', 'official-linkedin.json', 'independent-editorial.json', 'directory.json', 'review.json', 'ambiguous-brand.json', 'homonymous-company.json', 'partner-mention.json', 'duplicate-results.json', 'people-association.json', 'category-association.json', 'provider-failure.json']) {
  assert.ok(footprintFixtureNames.includes(fixture), `Missing external footprint fixture ${fixture}`);
  const fixtureContent = readFileSync(join(footprintFixtureDir, fixture), 'utf8');
  assert.match(fixtureContent, /"testOnly": true/, `Fixture ${fixture} must be marked testOnly`);
}

assert.match(audit, /state: 'not_calculated'/, 'Potential score must remain not_calculated without verified remediation simulation');
assert.doesNotMatch(audit, /remediationSummary\.length \* 2/, 'Old fake potential score heuristic must not return');
assert.match(audit, /agent_protocols_applicable', 'not_applicable'/, 'Agent protocols must be N/A when not pertinent');
assert.match(audit, /external_provider_available', 'unknown'/, 'External footprint must remain unmeasured without provider');

for (const blocked of ['a === 10', 'a === 127', 'a === 169 && b === 254', 'address === METADATA_IP', "address === '::1'", "address.startsWith('fc')"]) {
  assert.ok(ssrf.includes(blocked), `SSRF guard missing ${blocked}`);
}
assert.match(ssrf, /type PinnedLookup/, 'Fetcher must use a pinned DNS lookup');
assert.match(ssrf, /lookup,/, 'Pinned lookup must be passed to the request options');
assert.match(ssrf, /socket\.remoteAddress/, 'Fetcher must validate remote socket address');
assert.match(audit, /export function classifyPageType\(url: string/, 'Page classification must be exposed');

const hardcodedSecretPattern = /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|pplx-[A-Za-z0-9_-]{20,})/;
for (const [name, content] of Object.entries({ methodology, providers, visibility, externalFootprint, types, client, methodologyPage })) {
  assert.doesNotMatch(content, hardcodedSecretPattern, `${name} must not contain hardcoded API keys`);
}

console.log('AI Score verifier passed');
