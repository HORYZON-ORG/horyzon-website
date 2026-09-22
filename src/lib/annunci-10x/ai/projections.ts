import type { AiOperationType } from '../types.ts';

const FORBIDDEN_INPUT_KEYS = new Set([
  'sessionSecret',
  'cookie',
  'cookies',
  'apiKey',
  'serviceRoleKey',
  'authorization',
  'payment',
  'purchase',
  'entitlements',
  'commercialContext',
  'price',
  'discountValue',
]);

export function projectAnnunci10xAiInput(operationType: AiOperationType, input: Record<string, unknown>): Record<string, unknown> {
  const projected = sanitizeInput(input);
  if (operationType === 'PRECHECK') return pick(projected, ['rawText', 'declaredChannel']);
  if (operationType === 'EXTRACT') return pick(projected, ['originalAd', 'userAnswers', 'existingRoleCard']);
  if (operationType === 'CLARIFY') return pick(projected, ['currentStep', 'roleCard', 'roleProfile', 'unresolvedConflicts']);
  if (operationType === 'PROFILE') return pick(projected, ['roleCard']);
  if (operationType === 'STRATEGY') return pick(projected, ['roleCard', 'roleProfile', 'strategyRules', 'channel']);
  if (operationType === 'GENERATE') return pick(projected, ['roleCard', 'roleProfile', 'communicationStrategy']);
  if (operationType === 'VALIDATE') return pick(projected, ['generatedAd', 'roleCard']);
  if (operationType === 'EVALUATE') return pick(projected, ['target', 'roleCard', 'roleProfile', 'communicationStrategy', 'channel', 'rubric']);
  if (operationType === 'CHANNEL_ADAPTER') return pick(projected, ['master', 'roleCard', 'targetChannel']);
  if (operationType === 'EDIT_CLASSIFIER') return pick(projected, ['editRequest', 'roleCard', 'currentMaster']);
  return pick(projected, ['currentMaster', 'roleCard', 'communicationStrategy', 'editRequest', 'validationIssues']);
}

function sanitizeInput(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeValue(value);
  return typeof sanitized === 'object' && sanitized !== null && !Array.isArray(sanitized) ? sanitized as Record<string, unknown> : {};
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value !== 'object' || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) continue;
    output[key] = sanitizeValue(child);
  }
  return output;
}

function pick(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of keys) if (record[key] !== undefined) output[key] = record[key];
  return output;
}
