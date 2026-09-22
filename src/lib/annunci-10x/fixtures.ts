import type { RubricCheckInput } from './score.ts';
import type { StrategyRuleInput } from './strategy-rules.ts';

export const ANNUNCI10X_METHOD_FIXTURES = {
  routineNonTechnical: {
    role: 'addetto pulizie',
    strategyInput: {
      rolePopularity: 'HIGH',
      demand: 'HIGH',
      workReality: 'ROUTINE',
      qualification: 'TRAINABLE',
      technicality: 'LOW',
      companyAttractiveness: 'UNKNOWN',
      offerStrength: 'MEDIUM',
    } satisfies StrategyRuleInput,
  },
  qualifiedTechnicalChallenge: {
    role: 'social media manager specialistico',
    strategyInput: {
      rolePopularity: 'HIGH',
      demand: 'HIGH',
      workReality: 'CHALLENGE',
      qualification: 'HIGH',
      technicality: 'HIGH',
      companyAttractiveness: 'MEDIUM',
      offerStrength: 'MEDIUM',
    } satisfies StrategyRuleInput,
  },
  mixedTechnical: {
    role: 'manutentore',
    strategyInput: {
      rolePopularity: 'MEDIUM',
      demand: 'HIGH',
      workReality: 'MIXED',
      qualification: 'HIGH',
      technicality: 'HIGH',
      companyAttractiveness: 'MEDIUM',
      offerStrength: 'MEDIUM',
    } satisfies StrategyRuleInput,
  },
  unknownPopularity: {
    role: 'ruolo di nicchia non classificato',
    strategyInput: {
      rolePopularity: 'UNKNOWN',
      demand: 'LOW',
      workReality: 'UNKNOWN',
      qualification: 'MEDIUM',
      technicality: 'MEDIUM',
      companyAttractiveness: 'UNKNOWN',
      offerStrength: 'LOW',
    } satisfies StrategyRuleInput,
  },
  scoreWithNotEvaluable: makeStatusFixture([
    ...Array(11).fill('PASS'),
    'PARTIAL',
    ...Array(4).fill('MISSING'),
    ...Array(4).fill('NOT_EVALUABLE'),
  ]),
  highScoreWithGate: makeStatusFixture([
    ...Array(19).fill('PASS'),
    'MISSING',
  ]),
  lowScoreWithoutGate: makeStatusFixture([
    ...Array(8).fill('PASS'),
    ...Array(12).fill('MISSING'),
  ]),
} as const;

function makeStatusFixture(statuses: string[]): RubricCheckInput[] {
  return statuses.map((status, index) => ({
    id: String(index + 1).padStart(2, '0'),
    status: status as RubricCheckInput['status'],
    evidence: [`fixture evidence ${index + 1}`],
    score: 999,
  }));
}
