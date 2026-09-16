'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function Journey() {
 const root = useRef<HTMLDivElement>(null);
 const video = useRef<HTMLVideoElement>(null);
 const [enabled, setEnabled] = useState(false);
 const [ready, setReady] = useState(false);
 const [failed, setFailed] = useState(false);
 const [paused, setPaused] = useState(false);
 const [loading, setLoading] = useState(false);
 const [needsTap, setNeedsTap] = useState(false);
 const attempt = useRef(0);

 const activate = useCallback(() => {
  const media = video.current;
  if (!media) return () => {};
  const current = ++attempt.current;
  setLoading(true);
  setNeedsTap(false);
  setPaused(false);
  media.muted = true;
  // Call play directly in the tap handler: Safari requires user activation.
  const playback = media.play();
  const timeout = window.setTimeout(() => {
   if (current !== attempt.current) return;
   ++attempt.current;
   media.pause();
   setLoading(false);
   setNeedsTap(true);
  }, 12000);
  void playback.then(() => {
   if (current !== attempt.current) return;
   // Decode a frame, then return control of the timeline to scrolling.
   media.pause();
   setReady(true);
   setLoading(false);
   setNeedsTap(false);
  }).catch(() => {
   if (current !== attempt.current) return;
   setLoading(false);
   setNeedsTap(true);
  }).finally(() => window.clearTimeout(timeout));
  return () => {
   ++attempt.current;
   window.clearTimeout(timeout);
   media.pause();
  };
 }, []);

 useEffect(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => setEnabled(!preference.matches);
  update();
  preference.addEventListener('change', update);
  return () => preference.removeEventListener('change', update);
 }, []);

 useEffect(() => {
  if (!enabled) return;
  return activate();
 }, [enabled, activate]);

 useEffect(() => {
  const media = video.current;
  const story = root.current?.parentElement;
  if (!enabled || paused || failed || loading || !ready || !media || !story) return;
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
 }, [enabled, paused, failed, loading, ready]);

 return <div ref={root} data-motion={enabled && !paused ? 'enabled' : 'reduced'} data-failed={failed} className={`journey-visual ${ready && enabled && !failed && !paused ? 'is-ready' : ''}`}>
  <picture className="journey-fallback"><source media="(max-width:768px)" srcSet="/journey/horizon-mobile.webp"/><img src="/journey/horizon.webp" alt="" width="1672" height="941" fetchPriority="high"/></picture>
  {enabled && <video ref={video} className="journey-video" src="/journey/horizon-scroll.mp4" muted playsInline preload="auto" aria-hidden="true" onError={() => { setFailed(true); setLoading(false); }}/ >}
  <div className="journey-shade"/>
  <div className="journey-utility"><span aria-hidden="true">HORYZON <span className="utility-rule"/> UNA DIREZIONE CONDIVISA</span>{enabled && !failed && <button disabled={loading} onClick={() => { if (!ready || needsTap) activate(); else setPaused(!paused); }} aria-pressed={paused}>{loading ? 'Caricamento…' : !ready || needsTap ? 'Tocca per attivare il viaggio' : paused ? 'Attiva il viaggio' : 'Vista statica'}</button>}{failed && <p role="status">Video non disponibile. Puoi continuare a leggere il sito.</p>}</div>
 </div>;
}
