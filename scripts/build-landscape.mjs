import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import { mkdir } from 'node:fs/promises';
// Reproducible architectural ribbons. No external model or texture licenses.
const doc=new Document();const buffer=doc.createBuffer();const scene=doc.createScene('Horyzon landscape');
function material(name,color,metallic,rough){return doc.createMaterial(name).setBaseColorFactor([...new THREE.Color(color).toArray(),1]).setMetallicFactor(metallic).setRoughnessFactor(rough)}
const stone=material('Mineral stone','#344551',.3,.65),gold=material('Warm guiding edge','#d9bf8f',.6,.35);
gold.setEmissiveFactor([.25,.16,.07]);
function add(name,geometry,mat){const p=doc.createPrimitive().setMaterial(mat);for(const [key,attr] of Object.entries(geometry.attributes)){const semantic={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0'}[key];if(semantic)p.setAttribute(semantic,doc.createAccessor().setType(attr.itemSize===3?'VEC3':'VEC2').setArray(new Float32Array(attr.array)).setBuffer(buffer))}if(geometry.index)p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer));const mesh=doc.createMesh(name).addPrimitive(p);scene.addChild(doc.createNode(name).setMesh(mesh));geometry.dispose()}
function path(lane){const pts=[];for(let i=0;i<=12;i++){const z=35-i*10;const converge=Math.max(0,(z+70)/105);const x=Math.sin(i*.62+lane*.7)*4*converge+lane*8*converge;pts.push(new THREE.Vector3(x,1.7+lane*.6+Math.sin(i*.45)*.9,z))}return new THREE.CatmullRomCurve3(pts)}
for(let lane=-1;lane<=1;lane++){
 const curve=path(lane);const pts=curve.getPoints(180),width=lane===0?4.7:3.1;const pos=[],idx=[];
 for(let i=0;i<pts.length;i++){const tangent=curve.getTangent(i/180);const side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();for(const [sign,dy] of [[-1,0],[1,0],[-1,-.65],[1,-.65]]){const v=pts[i].clone().addScaledVector(side,sign*width/2);pos.push(v.x,v.y+dy,v.z)}if(i<180){const a=i*4,b=a+4;idx.push(a,b,a+1,a+1,b,b+1,a,a+2,b,a+2,b+2,b,a+1,b+1,a+3,a+3,b+1,b+3,a+2,a+3,b+2,a+3,b+3,b+2)}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();add('Bridge '+lane,geo,stone);
 for(const sign of [-1,1]){const edge=pts.map((p,i)=>{const t=curve.getTangent(i/180);return p.clone().add(new THREE.Vector3(-t.z,0,t.x).normalize().multiplyScalar(sign*width/2)).add(new THREE.Vector3(0,.08,0))});add('Guiding edge '+lane+' '+sign,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge),180,.022,4,false),gold)}
}
await MeshoptEncoder.ready;await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));await mkdir('public/journey',{recursive:true});await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder}).write('public/journey/landscape.glb',doc);
console.log('Generated compressed Horyzon landscape');
