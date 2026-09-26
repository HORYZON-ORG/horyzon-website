import assert from 'node:assert/strict';
import {
  ANNUNCI10X_CHECK_STATUSES_V2,
  ANNUNCI10X_RUBRIC_CHECKS_V2,
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_RUBRIC_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
  calculateAnnunci10xScoreV2,
  getScoreBandV2,
  validateAnnunci10xRubricV2,
  validateEvaluationChecksV2,
} from '../src/lib/annunci-10x/index.ts';

const ids = ANNUNCI10X_RUBRIC_CHECKS_V2.map((check) => check.id);

function makeCheck(id, score, status = 'EVALUATED', overrides = {}) {
  return {
    id,
    score,
    status,
    evidence: ['synthetic evidence'],
    reason: `Synthetic reason for ${id}`,
    missing: [],
    confidence: 80,
    ...overrides,
  };
}

function makeChecks(score, status = 'EVALUATED') {
  return ids.map((id) => makeCheck(id, score, status));
}

function expectInvalid(checks, pattern) {
  assert.equal(validateEvaluationChecksV2(checks).ok, false);
  assert.throws(() => calculateAnnunci10xScoreV2(checks), pattern);
}

const rubricValidation = validateAnnunci10xRubricV2();
assert.equal(rubricValidation.ok, true, rubricValidation.errors.join('\n'));
assert.equal(ANNUNCI10X_RUBRIC_V2.version, ANNUNCI10X_RUBRIC_VERSION_V2);
assert.equal(ANNUNCI10X_RUBRIC_V2.totalCheckCount, 20);
assert.equal(ANNUNCI10X_RUBRIC_V2.maxScorePerCheck, 10);
assert.equal(ANNUNCI10X_RUBRIC_CHECKS_V2.length, 20);
assert.deepEqual(ids, Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0')));
assert.equal(new Set(ids).size, 20);
for (const definition of ANNUNCI10X_RUBRIC_CHECKS_V2) {
  assert.equal(definition.maxScore, 10);
  assert.deepEqual(definition.anchors.map((anchor) => anchor.score), [0, 2, 4, 6, 8, 10]);
}
assert.deepEqual(ANNUNCI10X_CHECK_STATUSES_V2, ['EVALUATED', 'MISSING', 'UNSUPPORTED', 'CONFLICT', 'NOT_EVALUABLE']);

const allTens = calculateAnnunci10xScoreV2(makeChecks(10));
assert.equal(allTens.value, 100);
assert.equal(allTens.coverage, 100);
assert.equal(allTens.evaluableCheckCount, 20);
assert.equal(allTens.totalCheckCount, 20);
assert.equal(allTens.band?.code, 'EXCELLENT');
assert.equal(allTens.rubricVersion, ANNUNCI10X_RUBRIC_VERSION_V2);
assert.equal(allTens.scoreSemanticsVersion, ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2);

const allZero = calculateAnnunci10xScoreV2(makeChecks(0));
assert.equal(allZero.value, 0);
assert.equal(allZero.coverage, 100);
assert.equal(allZero.band?.code, 'CRITICAL');

assert.equal(getScoreBandV2(49.9)?.code, 'CRITICAL');
assert.equal(getScoreBandV2(50)?.code, 'WEAK');
assert.equal(getScoreBandV2(70)?.code, 'GOOD_BASE');
assert.equal(getScoreBandV2(85)?.code, 'STRONG');
assert.equal(getScoreBandV2(95)?.code, 'EXCELLENT');
assert.equal(getScoreBandV2(null), null);

const someNotEvaluable = calculateAnnunci10xScoreV2([
  ...ids.slice(0, 18).map((id) => makeCheck(id, 8)),
  ...ids.slice(18).map((id) => makeCheck(id, null, 'NOT_EVALUABLE', { evidence: [], reason: 'Not applicable for this target.' })),
]);
assert.equal(someNotEvaluable.value, 80);
assert.equal(someNotEvaluable.coverage, 90);
assert.equal(someNotEvaluable.evaluableCheckCount, 18);
assert.equal(someNotEvaluable.band?.code, 'GOOD_BASE');

const allNotEvaluable = calculateAnnunci10xScoreV2(ids.map((id) => makeCheck(id, null, 'NOT_EVALUABLE', {
  evidence: [],
  reason: 'Not applicable for this target.',
})));
assert.equal(allNotEvaluable.value, null);
assert.equal(allNotEvaluable.band, null);
assert.equal(allNotEvaluable.coverage, 0);
assert.equal(allNotEvaluable.evaluableCheckCount, 0);

expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, status: 'MISSING', score: 1, missing: ['fully missing'] } : check), /score must be 0 when status is MISSING/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, status: 'NOT_EVALUABLE', score: 3 } : check), /score must be null when status is NOT_EVALUABLE/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, score: null } : check), /score must be integer 0\.\.10/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, score: 11 } : check), /score must be integer 0\.\.10/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, score: -1 } : check), /score must be integer 0\.\.10/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, score: 4.5 } : check), /score must be integer 0\.\.10/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, confidence: 101 } : check), /confidence must be integer 0\.\.100/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, confidence: -1 } : check), /confidence must be integer 0\.\.100/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, confidence: 50.5 } : check), /confidence must be integer 0\.\.100/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, status: 'PASS' } : check), /status is invalid/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, reason: '   ' } : check), /reason must be non-empty/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, evidence: 'not-array' } : check), /evidence must be string\[\]/);
expectInvalid(makeChecks(10).map((check, index) => index === 0 ? { ...check, missing: [1] } : check), /missing must be string\[\]/);

expectInvalid([makeCheck('01', 10), ...ids.slice(1, 19).map((id) => makeCheck(id, 10)), makeCheck('01', 10)], /Duplicate V2 check input: 01/);
expectInvalid(ids.slice(0, 19).map((id) => makeCheck(id, 10)), /Expected 20 V2 checks|Missing V2 check input: 20/);
expectInvalid([...makeChecks(10).slice(0, 19), makeCheck('99', 10)], /id is unknown: 99|Missing V2 check input: 20/);

const highConfidence = calculateAnnunci10xScoreV2(makeChecks(7).map((check) => ({ ...check, confidence: 100 })));
const lowConfidence = calculateAnnunci10xScoreV2(makeChecks(7).map((check) => ({ ...check, confidence: 0 })));
assert.equal(highConfidence.value, lowConfidence.value, 'confidence must not affect final score');
assert.equal(highConfidence.band?.code, lowConfidence.band?.code, 'confidence must not affect band');

const ordered = calculateAnnunci10xScoreV2(ids.map((id, index) => makeCheck(id, index % 11)));
const reversed = calculateAnnunci10xScoreV2(ids.map((id, index) => makeCheck(id, index % 11)).reverse());
assert.equal(ordered.value, reversed.value, 'input order must not affect score');
assert.deepEqual(reversed.checks.map((check) => check.id), ids, 'result checks are canonical-order');

assert.equal('interval' in allTens, false);
assert.equal('minScore' in allTens, false);
assert.equal('maxScore' in allTens, false);

const partialMissing = calculateAnnunci10xScoreV2(makeChecks(6).map((check, index) => index === 0
  ? { ...check, status: 'EVALUATED', score: 4, missing: ['Specific schedule window missing.'] }
  : check));
assert.equal(partialMissing.checks[0].status, 'EVALUATED');
assert.equal(partialMissing.checks[0].score, 4);
assert.deepEqual(partialMissing.checks[0].missing, ['Specific schedule window missing.']);

const unsupported = calculateAnnunci10xScoreV2(makeChecks(6).map((check, index) => index === 0
  ? { ...check, status: 'UNSUPPORTED', score: 5, missing: ['Support for benefit claim missing.'] }
  : check));
assert.equal(unsupported.checks[0].score, 5, 'UNSUPPORTED can keep numeric score');

const conflict = calculateAnnunci10xScoreV2(makeChecks(6).map((check, index) => index === 0
  ? { ...check, status: 'CONFLICT', score: 3, missing: [] }
  : check));
assert.equal(conflict.checks[0].score, 3, 'CONFLICT can keep numeric score');

console.log('Annunci 10x V2 scoring verifier passed');
