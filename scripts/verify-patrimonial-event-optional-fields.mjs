import assert from 'node:assert/strict';
import {validatePilotLead} from '../src/lib/public-leads/patrimonial-funnels.ts';
import {pilotForms} from '../src/content/patrimonial-funnels.ts';
import {readFileSync} from 'node:fs';

const minimal={
  mode:'patrimonial-event',
  sourcePath:pilotForms['patrimonial-event'].path,
  firstName:'Ada',lastName:'Esempio',email:'ada@example.invalid',phone:'333 123 4567',
  province:'',profile:'',message:'',consent:true,marketingConsent:false,website:'',utm:{},
};
const received=validatePilotLead(minimal);
assert(received,'four mandatory fields plus privacy must be enough');
assert.equal(received.province,'');
assert.equal(received.profile,'');
assert.equal(received.phone,'+393331234567');
assert(validatePilotLead({...minimal,province:undefined}),'absent province should be accepted for event');
assert(validatePilotLead({...minimal,province:'Milano'}),'optional province accepted');
assert.equal(validatePilotLead({...minimal,province:'X'}),null,'invalid nonblank province rejected');
for(const key of ['firstName','lastName','email','phone']){
  assert.equal(validatePilotLead({...minimal,[key]:''}),null,key+' remains mandatory');
}
assert.equal(validatePilotLead({...minimal,consent:false}),null,'privacy acknowledgement remains mandatory');
assert.equal(validatePilotLead({...minimal,phone:'123'}),null,'invalid mobile blocked');
assert.equal(validatePilotLead({...minimal,email:'not an email'}),null,'invalid email blocked');
assert.equal(validatePilotLead({...minimal,mode:'architect-path',sourcePath:pilotForms['architect-path'].path}),null,
  'candidate form still enforces its own fields');

const form=readFileSync(new URL('../src/components/patrimonial-event-form.tsx',import.meta.url),'utf8');
for(const name of ['firstName','lastName','email','phone']){
  assert.match(form,new RegExp('name="'+name+'"[^>]*required'),name+' must be required in client');
}
assert.doesNotMatch(form,/<select value=\{region\}[^>]*required/, 'region must be optional');
assert.doesNotMatch(form,/<select name="province"[^>]*required/, 'province must be optional');
assert.match(form,/name="consent" type="checkbox" required/,'privacy consent still required');
console.log('Event minimal signup: mandatory identity, optional geography and qualification, privacy and bad inputs PASS');
