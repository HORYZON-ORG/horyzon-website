import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditCheckDefinitions,
  calculateEvidenceConfidence,
  readinessCategories,
} from '../src/lib/ai-score/methodology.ts';
import { classifyPageType } from '../src/lib/ai-score/audit.ts';
import { isPublicIp, normalizeAuditUrl } from '../src/lib/ai-score/ssrf.ts';
import type { AuditCheck, CrawlSummary, ExternalBrandFootprintResult, VisibilityScore } from '../src/lib/ai-score/types.ts';

const root = join(fileURLToPath(import.meta.url), '..', '..');

const totalWeight = readinessCategories.reduce((sum, category) => sum + category.weight, 0);
assert.equal(totalWeight, 100, 'Readiness category weights must total 100');
assert.ok(auditCheckDefinitions.length >= 60 && auditCheckDefinitions.length <= 80, 'AI Score should define 60-80 atomic checks');
assert.equal(new Set(auditCheckDefinitions.map((definition) => definition.id)).size, auditCheckDefinitions.length, 'Check ids must be unique');

const minimalChecks: AuditCheck[] = auditCheckDefinitions.slice(0, 10).map((definition, index) => ({
  id: definition.id,
  label: definition.label,
  categoryId: definition.categoryId,
  status: index < 5 ? 'pass' : 'unknown',
  pointsEarned: index < 5 ? 1 : 0,
  pointsAvailable: 1,
  measured: index < 5,
  evidence: index < 5 ? [{ label: 'sample', value: 'sample', verification: 'verified', verificationLevel: 'direct' }] : [],
}));

const crawlSummary: CrawlSummary = {
  requestedLimit: 6,
  pagesFetched: 1,
  pagesFailed: 5,
  duplicateUrlsSkipped: 0,
  classifications: { home: 1 },
  pages: [],
};

const visibility: VisibilityScore = {
  state: 'not_measured',
  score: null,
  methodologyVersion: 'test',
  weights: {
    brandMentionRate: 25,
    citationRate: 25,
    promptCoverage: 20,
    shareOfVoice: 15,
    crossEngineConsistency: 10,
    citationSourceDiversity: 5,
  },
  prompts: [],
  evidence: [],
};

const externalBrandFootprint: ExternalBrandFootprintResult = {
  state: 'not_measured',
  provider: 'none',
  brandMentions: null,
  independentSources: null,
  officialProfiles: [],
  evidence: [],
};

const confidence = calculateEvidenceConfidence({ checks: minimalChecks, crawlSummary, visibility, externalBrandFootprint });
assert.notEqual(confidence.label, 'HIGH', 'Missing visibility, footprint and crawl depth must not produce HIGH confidence');

assert.equal(isPublicIp('127.0.0.1'), false, 'loopback must be blocked');
assert.equal(isPublicIp('10.0.0.5'), false, 'private IPv4 must be blocked');
assert.equal(isPublicIp('169.254.169.254'), false, 'metadata endpoint must be blocked');
assert.equal(isPublicIp('::1'), false, 'IPv6 loopback must be blocked');
assert.equal(isPublicIp('8.8.8.8'), true, 'public IPv4 should be allowed by IP classifier');
assert.throws(() => normalizeAuditUrl('ftp://example.com'), /http e https/, 'non HTTP protocols must be rejected');
assert.throws(() => normalizeAuditUrl('https://user:pass@example.com'), /credenziali/, 'embedded credentials must be rejected');

assert.equal(classifyPageType('https://example.com/chi-siamo'), 'about');
assert.equal(classifyPageType('https://example.com/contatti'), 'contact');
assert.equal(classifyPageType('https://example.com/blog/guida-ai'), 'article');

const auditSource = readFileSync(join(root, 'src/lib/ai-score/audit.ts'), 'utf8');
assert.ok(auditSource.includes("state: 'not_calculated'"), 'Potential score must remain not_calculated without verified remediation simulation');
assert.ok(!auditSource.includes('remediationSummary.length * 2'), 'Old fake potential score heuristic must not return');

console.log('AI Score verifier passed');
