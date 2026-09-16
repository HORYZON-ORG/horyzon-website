'use client';
import { useEffect, useRef, useState } from 'react';

export function Journey() {
 const root = useRef<HTMLDivElement>(null);
 const video = useRef<HTMLVideoElement>(null);
 const [enabled, setEnabled] = useState(false);
 const [ready, setReady] = useState(false);
 const [failed, setFailed] = useState(false);
 const [paused, setPaused] = useState(false);

 useEffect(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => setEnabled(!preference.matches);
  update();
  preference.addEventListener('change', update);
  return () => preference.removeEventListener('change', update);
 }, []);

 useEffect(() => {
  const media = video.current;
  const story = root.current?.parentElement;
  if (!enabled || paused || failed || !media || !story) return;
  let frame = 0;
  let target = 0;
  const seek = () => {
   if (media.readyState < 2 || media.seeking) return;
   if (Math.abs(media.currentTime - target) > 1 / 60) media.currentTime = target;
  };
  const update = () => {
   frame = 0;
   if (!Number.isFinite(media.duration) || media.duration <= 0) return;
   const range = Math.max(1, story.offsetHeight - root.current!.clientHeight);
   const progress = Math.max(0, Math.min(1, -story.getBoundingClientRect().top / range));
   target = progress * Math.max(0, media.duration - 1 / 30);
   seek();
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const observer = new ResizeObserver(schedule);
  observer.observe(story);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  media.addEventListener('loadeddata', schedule);
  media.addEventListener('seeked', seek);
  schedule();
  return () => {
   cancelAnimationFrame(frame);
   observer.disconnect();
   window.removeEventListener('scroll', schedule);
   window.removeEventListener('resize', schedule);
   media.removeEventListener('loadeddata', schedule);
   media.removeEventListener('seeked', seek);
  };
 }, [enabled, paused, failed]);

 return <div ref={root} data-motion={enabled && !paused ? 'enabled' : 'reduced'} data-failed={failed} className={`journey-visual ${ready && enabled && !failed && !paused ? 'is-ready' : ''}`}>
  <picture className="journey-fallback"><source media="(max-width:768px)" srcSet="/journey/horizon-mobile.webp"/><img src="/journey/horizon.webp" alt="" width="1672" height="941" fetchPriority="high"/></picture>
  {enabled && !failed && <video ref={video} className="journey-video" src="/journey/horizon-scroll.mp4" muted playsInline preload="auto" aria-hidden="true" onLoadedData={() => setReady(true)} onError={() => setFailed(true)}/>}
  <div className="journey-shade"/>
  <div className="journey-utility"><span aria-hidden="true">HORYZON <span className="utility-rule"/> UNA DIREZIONE CONDIVISA</span>{enabled && !failed && <button onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? 'Attiva il viaggio' : 'Vista statica'}</button>}</div>
 </div>;
}
