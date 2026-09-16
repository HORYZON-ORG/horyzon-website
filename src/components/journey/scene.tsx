'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Landscape } from './landscape';
import { cameraStops, clamp, quality } from './config';
const skyVertex=`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const skyFragment=`varying vec3 vWorld;void main(){vec3 d=normalize(vWorld-cameraPosition);float y=clamp(d.y*.9+.12,0.,1.);vec3 low=vec3(.70,.57,.43);vec3 high=vec3(.065,.14,.22);vec3 c=mix(low,high,smoothstep(0.,.6,y));float sun=pow(max(0.,dot(d,normalize(vec3(.22,.09,-1.)))),220.);float halo=pow(max(0.,dot(d,normalize(vec3(.22,.09,-1.)))),12.);c+=vec3(1.,.76,.40)*sun*.9+vec3(.30,.16,.055)*halo;gl_FragColor=vec4(c,1.);}`;
function World({onReady,mobile}:{onReady:()=>void;mobile:boolean}) {
 const {camera,invalidate,setDpr}=useThree();
 const target=useRef(0),current=useRef(0),pointer=useRef({x:0,y:0});
 const active=useRef(true),visible=useRef(true);
 const look=useMemo(()=>new THREE.Vector3(),[]);
 const destination=useMemo(()=>new THREE.Vector3(),[]);
 const light=useRef<THREE.DirectionalLight>(null);
 const samples=useRef({count:0,total:0,reduced:false});
 useEffect(()=>{
  const story=document.getElementById('percorso');if(!story)return;
  const scroll=()=>{const r=story.getBoundingClientRect();target.current=clamp(-r.top/(story.offsetHeight-window.innerHeight));if(visible.current&&active.current)invalidate()};
  const move=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;pointer.current.x=(e.clientX/window.innerWidth-.5)*.4;pointer.current.y=(e.clientY/window.innerHeight-.5)*.16;if(visible.current&&active.current)invalidate()};
  const visibility=()=>{visible.current=!document.hidden;if(visible.current)invalidate()};
  const observer=new IntersectionObserver(([e])=>{active.current=e.isIntersecting;if(active.current)invalidate()});observer.observe(story);
  window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',scroll);window.addEventListener('pointermove',move,{passive:true});document.addEventListener('visibilitychange',visibility);scroll();
  return()=>{observer.disconnect();window.removeEventListener('scroll',scroll);window.removeEventListener('resize',scroll);window.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',visibility)};
 },[invalidate]);
 useFrame((_,delta)=>{
  if(!visible.current||!active.current)return;
  current.current=THREE.MathUtils.damp(current.current,target.current,5,Math.min(delta,.05));
  const p=current.current;let idx=0;while(idx<cameraStops.length-2&&p>cameraStops[idx+1].at)idx++;
  const a=cameraStops[idx],b=cameraStops[idx+1];const t=THREE.MathUtils.smoothstep(p,a.at,b.at);
  destination.set(THREE.MathUtils.lerp(a.position[0],b.position[0],t)*(mobile?.55:1)+pointer.current.x,THREE.MathUtils.lerp(a.position[1],b.position[1],t)+(mobile?2:0)+pointer.current.y,THREE.MathUtils.lerp(a.position[2],b.position[2],t));
  camera.position.lerp(destination,.15);
  look.set(THREE.MathUtils.lerp(a.target[0],b.target[0],t),THREE.MathUtils.lerp(a.target[1],b.target[1],t),THREE.MathUtils.lerp(a.target[2],b.target[2],t));camera.lookAt(look);
  if(light.current)light.current.intensity=2.3+p*2;
  if(delta<.15){samples.current.count++;samples.current.total+=delta;if(samples.current.count===90&&!samples.current.reduced&&samples.current.total/90>.032){setDpr(1);samples.current.reduced=true}}
  if(Math.abs(p-target.current)>.0001||camera.position.distanceToSquared(destination)>.00001)invalidate();
 });
 return <>
  <mesh><sphereGeometry args={[450,24,16]}/><shaderMaterial side={THREE.BackSide} vertexShader={skyVertex} fragmentShader={skyFragment} depthWrite={false}/></mesh>
  <fog attach="fog" args={['#71808a',38,180]}/>
  <hemisphereLight args={['#bacad6','#15232c',2]}/>
  <directionalLight ref={light} position={[25,15,-90]} color="#ffdaa5" intensity={3}/>
  <directionalLight position={[-20,20,20]} color="#87adc6" intensity={1.5}/>
  <Suspense fallback={null}><Landscape mobile={mobile} progress={current} onReady={onReady}/></Suspense>
 </>;
}
export default function Scene({onReady,onFailure}:{onReady:()=>void;onFailure:(reason:string)=>void}) {
 const [mobile,setMobile]=useState(()=>window.innerWidth<=quality.mobileWidth);
 useEffect(()=>{const query=matchMedia(`(max-width: ${quality.mobileWidth}px)`);const update=()=>setMobile(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 return <div className="journey-canvas" aria-hidden="true"><Canvas frameloop="demand" dpr={[1,mobile?quality.mobileDpr:quality.desktopDpr]} camera={{position:[11,8,31],fov:mobile?62:49,near:.2,far:500}} gl={{antialias:!mobile,alpha:false,powerPreference:'high-performance'}} fallback={<span>Il paesaggio statico mantiene disponibili tutti i contenuti.</span>} onCreated={({gl})=>{gl.domElement.addEventListener('webglcontextlost',()=>onFailure('WebGL context lost'),{once:true});gl.setClearColor('#081521')}}><World onReady={onReady} mobile={mobile}/></Canvas></div>;
}