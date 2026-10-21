import assert from 'node:assert/strict';
import { saveVerifiedRadarReferenceInHub } from '../src/lib/public-leads/patrimonial-hub-radar-link.ts';

const binding = {
  contactId: '11111111-1111-4111-8111-111111111111',
  assessmentId: '22222222-2222-4222-8222-222222222222',
  registrationId: '33333333-3333-4333-8333-333333333333',
  questionnaireVersion: 'patrimonial-v1',
  status: 'IN_PROGRESS',
  completedAt: null,
};
const env = {
  SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-secret',
  HORYZON_HUB_RADAR_LINK_ENABLED: 'true',
};
let requests = 0;
const fetchImpl = async (url, init) => {
  requests++;
  assert.equal(new URL(url).pathname, '/rest/v1/rpc/architetti_radar_link');
  assert.equal(init.method, 'POST');
  const link = JSON.parse(init.body).p_link;
  assert.equal(link.contactId, binding.contactId);
  assert.equal(link.assessmentId, binding.assessmentId);
  assert.equal(link.registrationId, binding.registrationId);
  assert.equal(link.questionnaireVersion, binding.questionnaireVersion);
  return Response.json({
    contactId: link.contactId, assessmentId: link.assessmentId, status: link.status,
  });
};
assert.equal(await saveVerifiedRadarReferenceInHub({binding,env:{...env,HORYZON_HUB_RADAR_LINK_ENABLED:'false'},fetchImpl}),'DISABLED');
assert.equal(requests,0);
assert.equal(await saveVerifiedRadarReferenceInHub({binding,env,fetchImpl}),'LINKED');
assert.equal(await saveVerifiedRadarReferenceInHub({binding:{...binding,status:'COMPLETED',completedAt:'2026-10-20T18:00:00Z'},env,fetchImpl}),'LINKED');
assert.equal(requests,2);
await assert.rejects(() => saveVerifiedRadarReferenceInHub({binding:{...binding,assessmentId:'not-uuid'},env,fetchImpl}), /RADAR_BINDING_INVALID/);
await assert.rejects(() => saveVerifiedRadarReferenceInHub({binding:{...binding,status:'COMPLETED',completedAt:null},env,fetchImpl}), /RADAR_BINDING_INVALID/);
await assert.rejects(() => saveVerifiedRadarReferenceInHub({binding,env:{...env,SUPABASE_URL:'https://evil.example'},fetchImpl}), /RADAR_LINK_CONFIG/);
await assert.rejects(() => saveVerifiedRadarReferenceInHub({binding,env,fetchImpl:async()=>Response.json({contactId:binding.contactId,assessmentId:'00000000-0000-4000-8000-000000000000',status:binding.status})}), /RADAR_LINK_UNCONFIRMED/);
assert.equal(requests,2);
console.log('Hub Radar link: closed by default, UUID and status validation, receipt binding PASS');
