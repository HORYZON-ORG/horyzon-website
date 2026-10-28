import assert from 'node:assert/strict';
import { diagnose } from '../src/lib/patrimonial-radar/result.ts';
import { customerProjection } from '../src/lib/patrimonial-radar-server/customer-projection.ts';
import { localSimulatedEmail } from '../src/lib/patrimonial-radar-server/simulated-email.ts';
import { localNextRequest } from '../src/lib/patrimonial-radar-server/runtime.ts';
import { buildFixture } from './patrimonial-radar-fixtures.mjs';

for (let n = 1; n <= 14; n++) {
  const result = diagnose(buildFixture(`T${String(n).padStart(2, '0')}`));
  // Sentinel fields must never spread from the canonical result to the customer payload.
  const customer = customerProjection({ result: { ...result, advisorSentinel: 'PRIVATE' } });
  assert.deepEqual(Object.keys(customer).sort(), ['projectionVersion','asOf','scope','partial','areas','strengths','priorities','further','limitations','incoherent','reconfirmCount','inactiveCount','goals','goalChecks'].sort());
  for (const a of ['A','B','C','D','E','F']) {
    assert.equal(customer.areas[a].state, result.areas[a].state);
    assert.equal(customer.areas[a].resolved, result.completeness[a].resolved);
    assert.equal(customer.areas[a].applicable, result.completeness[a].applicable);
    assert.deepEqual(customer.areas[a].evidence, result.evidence.filter(e => result.areas[a].evidenceIds.includes(e.id)).map(e => ({ text: e.text, limitation: e.limitation })));
  }
  const material = [...customer.priorities, ...customer.further];
  for (const e of result.evidence.filter(e => e.kind === 'VULNERABILITY')) assert.ok(material.includes(e.text), `T${n}: material vulnerability never truncated`);
  for (const e of result.evidence.filter(e => e.kind === 'MISSING')) assert.ok(customer.limitations.includes(e.text));
  assert.ok(customer.strengths.length <= 2);
  assert.ok(customer.strengths.every(text => result.evidence.some(e => e.kind === 'FAVORABLE' && e.text === text)));
  assert.doesNotMatch(JSON.stringify(customer), /PRIVATE|"(indicators|history|answers|profiles|interviewQuestions|formula|refs|resources|experience|target)":/);
}
for (const url of ['https://remote.supabase.co/simulated-email', 'http://127.0.0.1:9999/inbox', 'http://127.0.0.1:9999/simulated-email?code=1']) assert.throws(() => localSimulatedEmail(url, 'test'), /UNAVAILABLE/);
await assert.rejects(localSimulatedEmail('http://127.0.0.1:9999/simulated-email', 'test').sendCode({ email: 'real@example.com', code: '12345678', expiresInSeconds: 600 }), /UNAVAILABLE/);
console.log('PASS 14 canonical/customer fixture parity, all material vulnerabilities and significant missing facts retained, 0–2 supported strengths, strict customer allowlist, no Advisor fields, simulated email rejects remote/non-synthetic destinations.');

const origin = new URL('http://127.0.0.1:3321');
const internal = new Request('http://localhost:3321/api/patrimonial-radar/session', { headers: { host: origin.host } });
assert.equal(localNextRequest(internal, origin).url, 'http://127.0.0.1:3321/api/patrimonial-radar/session');
for (const url of ['http://evil.invalid:3321/api/patrimonial-radar/session', 'http://localhost:9999/api/patrimonial-radar/session', 'https://localhost:3321/api/patrimonial-radar/session']) {
 const request = new Request(url, { headers: { host: origin.host } }); assert.equal(localNextRequest(request, origin), request);
}
for (const headers of [{host:'evil.invalid:3321'}, {'x-forwarded-host':origin.host}]) { const request = new Request(internal.url,{headers}); assert.equal(localNextRequest(request,origin),request); }
console.log('PASS Next local transport normalization requires exact Host/port/protocol and localhost; forged/forwarded/remote origins stay rejected.');
