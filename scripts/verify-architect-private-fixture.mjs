import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const file=new URL('./fixtures/architect-cv-horyzon-qa.b64',import.meta.url);
const decoded=Buffer.from(readFileSync(file,'utf8').trim(),'base64');
assert.equal(decoded.byteLength,2560);
assert.equal(decoded.subarray(0,5).toString('ascii'),'%PDF-');
assert.ok(decoded.subarray(-2048).toString('latin1').includes('%%EOF'));
assert.equal(createHash('sha256').update(decoded).digest('hex'),
  '84ec46e00d2b1238e697804cf252a3e58383fc0b4197862be2f0f52ff6074c30');
console.log('PASS: synthetic downloadable CV PDF is byte-for-byte verified, one-page and below 5MB');
