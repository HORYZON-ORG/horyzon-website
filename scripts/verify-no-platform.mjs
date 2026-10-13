import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const banned = /horyzon\s+platform|platform\.horyzon\.it|\bPlatform\b|href="(?:https:\/\/horyzon\.it)?\/(?:piattaforma|platform)(?:["/?#])/i;
// The RSC payload includes the requested slug even on a 404. Inspect the
// public document and JSON-LD separately from the internal routing payload.
const publicDocument = text => text.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi,
 (script, attributes) => /type=["']application\/ld\+json["']/i.test(attributes) ? script : '');
async function scan(directory) {
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  const path=`${directory}/${entry.name}`;
  if(entry.isDirectory())await scan(path);
  else if(/\.(?:html|body)$/.test(entry.name)) {
   const text=await readFile(path,'utf8');
   assert(!banned.test(publicDocument(text)),`${path}: public Platform reference`);
  }
 }
}
await scan('.next/server/app');
for(const file of ['public/home.md','.next/server/app/llms.txt.body','.next/server/app/index.md.body','.next/server/app/sitemap.xml.body']) {
 const text=await readFile(file,'utf8');
 assert(!banned.test(text)&&!text.includes('https://horyzon.it/piattaforma'),`${file}: retired product reference`);
}
const manifest=JSON.parse(await readFile('.next/prerender-manifest.json','utf8'));
assert(!manifest.routes['/piattaforma'],'retired route must not be generated');
const base=process.argv[2];
if(base)for(const path of ['/piattaforma','/piattaforma/','/platform','/horyzon-platform','/en/platform','/de/piattaforma','/fr/piattaforma']) {
 const response=await fetch(base+path);
 assert.equal(response.status,404,`${path}: must no longer serve a product page`);
 assert(!banned.test(publicDocument(await response.text())),`${path}: retired page leaks marketing`);
}
console.log('No Platform promotion in generated HTML, metadata, schema, sitemap or Markdown; dedicated routes retired.');
