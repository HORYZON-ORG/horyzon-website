'use client';
import dynamic from 'next/dynamic';
import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
const Scene = dynamic(() => import('./scene'), { ssr: false });
class SceneBoundary extends Component<{children: ReactNode; onError:(reason:string)=>void}, {failed:boolean}> {
 state = { failed: false };
 static getDerivedStateFromError() { return { failed: true }; }
 componentDidCatch(error:Error) { this.props.onError(error.message); }
 render() { return this.state.failed ? null : this.props.children; }
}
export function Journey() {
 const root = useRef<HTMLDivElement>(null);
 const video = useRef<HTMLVideoElement>(null);
 const [enabled,setEnabled]=useState(false);
 const [ready,setReady]=useState(false);
 const [failed,setFailed]=useState('');
 const [paused,setPaused]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>{
   if(media.matches){setEnabled(false);return;}
   const probe=document.createElement('canvas');
   const context=probe.getContext('webgl2');
   if(!context){setFailed('WebGL unavailable');setEnabled(false);return;}
   context.getExtension('WEBGL_lose_context')?.loseContext();
   setEnabled(true);
  };
  update(); media.addEventListener('change',update);
  return ()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  const update = () => {
   const element = root.current;
   const media = video.current;
   if (!element || !media || !media.duration) return;
   const range = Math.max(1, element.parentElement?.scrollHeight ?? 1) - window.innerHeight;
   const progress = Math.max(0, Math.min(1, window.scrollY / Math.max(1, range)));
   media.currentTime = progress * media.duration;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
 },[]);
 return <div ref={root} data-motion={enabled?'enabled':'reduced'} data-failed={failed} className={`journey-visual ${ready && enabled && !failed && !paused?'is-ready':''}`}>
  <picture className="journey-fallback"><source media="(max-width:768px)" srcSet="/journey/horizon-mobile.webp"/><img src="/journey/horizon.webp" alt="" width="1672" height="941" fetchPriority="high"/></picture>
  <video ref={video} className="journey-video" src="/journey/horizon-scroll.mp4" muted playsInline preload="metadata" aria-hidden="true"/>
  {enabled && !failed && !paused && <SceneBoundary onError={setFailed}><Scene onReady={()=>setReady(true)} onFailure={setFailed}/></SceneBoundary>}
  <div className="journey-shade"/>
  <div className="journey-utility"><span aria-hidden="true">HORYZON <span className="utility-rule"/> UNA DIREZIONE CONDIVISA</span>{enabled && !failed && <button onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused?'Attiva esperienza 3D':'Vista statica'}</button>}</div>
 </div>;
}
