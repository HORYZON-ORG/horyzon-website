import { ANNUNCI10X_STRATEGY_VERSION } from './constants.ts';

export type StrategyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type WorkRealitySignal = 'ROUTINE' | 'CHALLENGE' | 'MIXED' | 'UNKNOWN';
export type StrategyStructure = 'RESULT_FIRST' | 'OPPORTUNITY_FIRST' | 'WORK_REALITY_FIRST' | 'PROBLEM_FIRST';

export interface StrategyRuleInput {
  rolePopularity: StrategyLevel;
  demand: Exclude<StrategyLevel, 'UNKNOWN'> | 'UNKNOWN';
  workReality: WorkRealitySignal;
  qualification: StrategyLevel | 'TRAINABLE';
  technicality: StrategyLevel;
  companyAttractiveness: StrategyLevel;
  offerStrength?: StrategyLevel;
}

export interface StrategyRuleOutput {
  strategyVersion: string;
  preservedRolePopularity: StrategyLevel;
  levers: {
    resultClarity: StrategyLevel;
    standardContribution: StrategyLevel;
    offer: StrategyLevel;
    selectivity: StrategyLevel;
    responsibilityChallenge: StrategyLevel;
    competenceRelevance: StrategyLevel;
    organization: StrategyLevel;
    toolsSupportAccessibility: StrategyLevel;
    difficultyVisibility: StrategyLevel;
    stability: StrategyLevel;
    technicalDepth: StrategyLevel;
    companyCredibility: StrategyLevel;
  };
  structures: {
    preferred: StrategyStructure[];
    compatible: StrategyStructure[];
    excluded: StrategyStructure[];
  };
  constraints: string[];
}

export function deriveAnnunci10xStrategyRules(input: StrategyRuleInput): StrategyRuleOutput {
  const levers = baselineLevers();
  const constraints: string[] = [];

  if (input.rolePopularity === 'HIGH' && input.demand === 'LOW') {
    raise(levers, 'resultClarity', 'HIGH');
    raise(levers, 'standardContribution', 'HIGH');
    raise(levers, 'offer', 'MEDIUM');
    raise(levers, 'selectivity', 'MEDIUM');
  }

  if (input.rolePopularity === 'HIGH' && input.demand === 'HIGH') {
    raise(levers, 'resultClarity', 'HIGH');
    raise(levers, 'responsibilityChallenge', 'HIGH');
    raise(levers, 'competenceRelevance', 'HIGH');
    raise(levers, 'offer', 'MEDIUM');
    raise(levers, 'selectivity', 'HIGH');
  }

  if (input.rolePopularity === 'LOW' && input.demand === 'LOW') {
    raise(levers, 'offer', 'HIGH');
    raise(levers, 'organization', 'HIGH');
    raise(levers, 'toolsSupportAccessibility', 'HIGH');
    lower(levers, 'selectivity', 'MEDIUM');
  }

  if (input.rolePopularity === 'LOW' && input.demand === 'HIGH') {
    raise(levers, 'offer', 'HIGH');
    raise(levers, 'toolsSupportAccessibility', 'HIGH');
    raise(levers, 'difficultyVisibility', 'HIGH');
    raise(levers, 'resultClarity', 'HIGH');
    lower(levers, 'selectivity', 'MEDIUM');
  }

  if (input.rolePopularity === 'UNKNOWN') {
    constraints.push('Role popularity remains UNKNOWN and must not be coerced to LOW or HIGH.');
  }

  if (input.workReality === 'ROUTINE') {
    raise(levers, 'stability', 'HIGH');
    raise(levers, 'standardContribution', 'HIGH');
    constraints.push('Do not introduce artificial continuous challenge for a routine-led role.');
  } else if (input.workReality === 'CHALLENGE') {
    raise(levers, 'responsibilityChallenge', 'HIGH');
    raise(levers, 'resultClarity', 'HIGH');
  } else if (input.workReality === 'MIXED') {
    raise(levers, 'stability', 'MEDIUM');
    raise(levers, 'responsibilityChallenge', 'HIGH');
    raise(levers, 'resultClarity', 'HIGH');
    constraints.push('Represent planned work and unexpected problems together.');
  }

  if (input.qualification === 'HIGH') {
    raise(levers, 'selectivity', 'HIGH');
    raise(levers, 'competenceRelevance', 'HIGH');
  } else if (input.qualification === 'LOW' || input.qualification === 'TRAINABLE') {
    raise(levers, 'toolsSupportAccessibility', 'HIGH');
    lower(levers, 'selectivity', 'MEDIUM');
    constraints.push('Separate trainable requirements from real must-haves.');
  }

  if (input.demand === 'HIGH') raise(levers, 'difficultyVisibility', 'HIGH');
  if (input.technicality === 'HIGH') raise(levers, 'technicalDepth', 'HIGH');
  if (input.technicality === 'LOW') constraints.push('Avoid ornamental technical jargon.');

  if (input.companyAttractiveness === 'LOW' || input.companyAttractiveness === 'UNKNOWN') {
    raise(levers, 'companyCredibility', input.offerStrength === 'HIGH' ? 'HIGH' : 'MEDIUM');
    constraints.push('Company credibility must be built from facts, not unsupported promotion.');
  }

  return {
    strategyVersion: ANNUNCI10X_STRATEGY_VERSION,
    preservedRolePopularity: input.rolePopularity,
    levers,
    structures: deriveEditorialStructures(input),
    constraints,
  };
}

export function deriveEditorialStructures(input: StrategyRuleInput): StrategyRuleOutput['structures'] {
  const preferred: StrategyStructure[] = [];
  const compatible = new Set<StrategyStructure>(['RESULT_FIRST', 'OPPORTUNITY_FIRST', 'WORK_REALITY_FIRST', 'PROBLEM_FIRST']);
  const excluded = new Set<StrategyStructure>();

  if (input.workReality === 'ROUTINE' && input.technicality === 'LOW') {
    preferred.push('WORK_REALITY_FIRST');
    excluded.add('PROBLEM_FIRST');
  }

  if (input.workReality === 'CHALLENGE' && input.qualification === 'HIGH') {
    preferred.push('RESULT_FIRST', 'PROBLEM_FIRST');
  }

  if (input.workReality === 'MIXED') {
    preferred.push('RESULT_FIRST', 'WORK_REALITY_FIRST');
  }

  if ((input.companyAttractiveness === 'LOW' || input.companyAttractiveness === 'UNKNOWN') && input.offerStrength === 'HIGH') {
    preferred.unshift('OPPORTUNITY_FIRST');
  }

  for (const item of excluded) compatible.delete(item);
  const dedupedPreferred = unique(preferred).filter((item) => compatible.has(item));

  return {
    preferred: dedupedPreferred.length ? dedupedPreferred : ['RESULT_FIRST'],
    compatible: [...compatible],
    excluded: [...excluded],
  };
}

function baselineLevers(): StrategyRuleOutput['levers'] {
  return {
    resultClarity: 'MEDIUM',
    standardContribution: 'MEDIUM',
    offer: 'MEDIUM',
    selectivity: 'MEDIUM',
    responsibilityChallenge: 'MEDIUM',
    competenceRelevance: 'MEDIUM',
    organization: 'MEDIUM',
    toolsSupportAccessibility: 'MEDIUM',
    difficultyVisibility: 'MEDIUM',
    stability: 'MEDIUM',
    technicalDepth: 'MEDIUM',
    companyCredibility: 'MEDIUM',
  };
}

function raise(levers: StrategyRuleOutput['levers'], key: keyof StrategyRuleOutput['levers'], value: StrategyLevel): void {
  if (rank(value) > rank(levers[key])) levers[key] = value;
}

function lower(levers: StrategyRuleOutput['levers'], key: keyof StrategyRuleOutput['levers'], value: StrategyLevel): void {
  if (rank(value) < rank(levers[key])) levers[key] = value;
}

function rank(value: StrategyLevel): number {
  if (value === 'LOW') return 1;
  if (value === 'MEDIUM' || value === 'UNKNOWN') return 2;
  return 3;
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
