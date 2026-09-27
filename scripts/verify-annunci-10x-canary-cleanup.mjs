import assert from 'node:assert/strict';

import {
  annotateCanaryCleanupContext,
  buildCanaryFailureReport,
  resolveCanaryCleanupSettings,
} from './annunci10x-openai-v2-canary.mjs';

const sessionId = '11111111-1111-4111-8111-111111111111';
const sessionSecret = 'secret-session-value';
const openAiKey = 'sk-secret-openai-value';
const serviceRoleKey = 'service-role-secret-value';
const authorization = 'Bearer secret-authorization-value';

const defaultSettings = resolveCanaryCleanupSettings({});
assert.equal(defaultSettings.cleanupMode, 'INTERNAL');
assert.equal(defaultSettings.shouldAssertCleanupPermission, true);
assert.equal(defaultSettings.shouldAutoCleanup, true);

const internalSettings = resolveCanaryCleanupSettings({ ANNUNCI10X_CANARY_CLEANUP_MODE: 'INTERNAL' });
assert.equal(internalSettings.cleanupMode, 'INTERNAL');
assert.equal(internalSettings.shouldAssertCleanupPermission, true);
assert.equal(internalSettings.shouldAutoCleanup, true);

assert.throws(
  () => resolveCanaryCleanupSettings({ ANNUNCI10X_CANARY_CLEANUP_MODE: 'EXTERNAL' }),
  (error) => error.canaryCode === 'OPENAI_CANARY_BLOCKED_EXTERNAL_CLEANUP_GUARD',
);

const externalSettings = resolveCanaryCleanupSettings({
  ANNUNCI10X_CANARY_CLEANUP_MODE: 'EXTERNAL',
  ANNUNCI10X_CANARY_ALLOW_EXTERNAL_CLEANUP: '1',
});
assert.equal(externalSettings.cleanupMode, 'EXTERNAL');
assert.equal(externalSettings.shouldAssertCleanupPermission, false);
assert.equal(externalSettings.shouldAutoCleanup, false);

assert.throws(
  () => resolveCanaryCleanupSettings({ ANNUNCI10X_CANARY_CLEANUP_MODE: 'SURPRISE' }),
  (error) => error.canaryCode === 'OPENAI_CANARY_BLOCKED_INVALID_CLEANUP_MODE',
);

const beforeSession = buildCanaryFailureReport(
  annotateCanaryCleanupContext(new Error('Before session creation.'), {
    cleanupMode: 'EXTERNAL',
    sessionId: null,
  }),
);
assert.equal(beforeSession.cleanupMode, 'EXTERNAL');
assert.equal(beforeSession.cleanupRequired, false);
assert.equal(beforeSession.canarySessionId, null);

const afterSessionError = new Error('After session creation.');
afterSessionError.details = {
  sessionSecret,
  OPENAI_API_KEY: openAiKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  headers: {
    authorization,
  },
};
const afterSession = buildCanaryFailureReport(
  annotateCanaryCleanupContext(afterSessionError, {
    cleanupMode: 'EXTERNAL',
    sessionId,
  }),
);
assert.equal(afterSession.cleanupMode, 'EXTERNAL');
assert.equal(afterSession.cleanupRequired, true);
assert.equal(afterSession.canarySessionId, sessionId);

const reportJson = JSON.stringify(afterSession);
assert.equal(reportJson.includes(sessionId), true, 'external cleanup report must include canary session id');
assert.equal(reportJson.includes(sessionSecret), false, 'report must not leak sessionSecret values');
assert.equal(reportJson.includes(openAiKey), false, 'report must not leak OpenAI key values');
assert.equal(reportJson.includes(serviceRoleKey), false, 'report must not leak Supabase service role values');
assert.equal(reportJson.includes(authorization), false, 'report must not leak authorization header values');
assert.equal(/sessionSecret/i.test(reportJson), false, 'report must not include sessionSecret keys');
assert.equal(/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|authorization/i.test(reportJson), false, 'report must not include secret-like keys');
assert.equal(reportJson.includes('[REDACTED]'), true, 'secret-like details must be redacted');

console.log('Annunci 10x canary cleanup verifier passed');
