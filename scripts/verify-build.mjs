import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { validateBytes } from 'gltf-validator';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
const binary=new Uint8Array(await readFile('public/journey/landscape.glb'));
const report=await validateBytes(binary,{uri:'landscape.glb'});
assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues.messages));
await MeshoptDecoder.ready;
const model=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read('public/journey/landscape.glb');
assert.equal(model.getRoot().listMeshes().length,9);
let triangles=0;for(const mesh of model.getRoot().listMeshes())for(const p of mesh.listPrimitives()){assert(p.getAttribute('POSITION'));assert(p.getAttribute('NORMAL'));triangles+=p.getIndices().getCount()/3;}
assert(triangles<60000);assert(binary.byteLength<250000);
assert((await stat('public/journey/horizon.webp')).size<350000);assert((await stat('public/journey/horizon-mobile.webp')).size<150000);
const manifest=JSON.parse(await readFile('.next/prerender-manifest.json','utf8'));
const routes=new Set(Object.keys(manifest.routes));
const home=await readFile('.next/server/app/index.html','utf8');
assert.equal((home.match(/<h1\b/g)||[]).length,1);
for(const id of ['orizzonte','presente','radar','organismo','percorso-operativo','infrastruttura','progresso','prossimo-orizzonte'])assert(home.includes(`id="${id}"`));
const links=[...new Set([...home.matchAll(/href="(\/[^"?#]*)/g)].map(x=>x[1]))].filter(x=>!x.startsWith('/_next/'));
for(const link of links){if(routes.has(link))continue;try{await stat('public'+link)}catch{throw new Error('Unresolved homepage link: '+link)}}
for(const route of ['/contatti','/metodo','/misura','/persone','/biblioteca','/privacy-policy','/cookie-policy','/v/gianluca','/v/frank/contact.vcf'])assert(routes.has(route),'Missing preserved route '+route);
assert(home.includes('https://schema.org'));assert(home.includes('rel="canonical" href="https://horyzon.it"'));
console.log(JSON.stringify({gltfErrors:0,gltfWarnings:report.issues.numWarnings,modelBytes:binary.byteLength,modelTriangles:triangles,staticRoutes:routes.size,homepageLinksChecked:links.length,essentialHTML:'passed'},null,2));
