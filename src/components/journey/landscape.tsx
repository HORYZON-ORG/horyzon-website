'use client';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { quality } from './config';
export function Landscape({mobile,progress,onReady}:{mobile:boolean;progress:React.RefObject<number>;onReady:()=>void}) {
 const {scene}=useGLTF('/journey/landscape.glb',false,true);
 const pillars=useRef<THREE.InstancedMesh>(null);
 const beams=useRef<THREE.InstancedMesh>(null);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);
 const count=mobile?quality.mobilePillars:quality.desktopPillars;
 const pieces=useMemo(()=>Array.from({length:count},(_,i)=>{const side=i%2?1:-1;return {x:side*(9+(Math.sin(i*127.1)*.5+.5)*23),z:28-(i/count)*116,y:2+(Math.sin(i*43.7)*.5+.5)*13,angle:Math.sin(i*2.7)*.9}}),[count]);
 useEffect(()=>{onReady()},[onReady]);
 useFrame(()=>{
  const align=THREE.MathUtils.smoothstep(progress.current,.18,.85);
  pieces.forEach((p,i)=>{dummy.position.set(p.x,-5+p.y/2,p.z);dummy.rotation.set(0,p.angle*(1-align),0);dummy.scale.set(2.4,p.y,3.1);dummy.updateMatrix();pillars.current?.setMatrixAt(i,dummy.matrix);dummy.position.y=p.y-5;dummy.scale.set(6,.13,1.6);dummy.updateMatrix();beams.current?.setMatrixAt(i,dummy.matrix)});
  if(pillars.current)pillars.current.instanceMatrix.needsUpdate=true;
  if(beams.current)beams.current.instanceMatrix.needsUpdate=true;
 });
 return <group>
  <primitive object={scene}/>
  <instancedMesh ref={pillars} args={[undefined,undefined,count]} frustumCulled={false}><boxGeometry/><meshStandardMaterial color="#263b47" roughness={.74} metalness={.28}/></instancedMesh>
  <instancedMesh ref={beams} args={[undefined,undefined,count]} frustumCulled={false}><boxGeometry/><meshStandardMaterial color="#53616a" roughness={.4} metalness={.48}/></instancedMesh>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-5, -50]}><planeGeometry args={[650,650]}/><meshStandardMaterial color="#526974" roughness={.24} metalness={.65}/></mesh>
  <group position={[0,-10,-155]}>{Array.from({length:mobile?9:15},(_,i)=><mesh key={i} position={[(i-7)*27,0,-Math.sin(i)*15]} scale={[2.7,1,1.7]}><coneGeometry args={[18,12+Math.sin(i*7)*6,7]}/><meshStandardMaterial color="#4b606d" roughness={1}/></mesh>)}</group>
 </group>;
}
