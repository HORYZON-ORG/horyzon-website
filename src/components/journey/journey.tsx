'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createScrubController, scrollTime } from './scrub-controller';
import { scrollToPageTop } from './scroll-to-page-top';

export function Journey() {
 const root = useRef<HTMLDivElement>(null);
 const video = useRef<HTMLVideoElement>(null);
 const [enabled, setEnabled] = useState(false);
 const [ready, setReady] = useState(false);
 const [failed, setFailed] = useState(false);
 const [paused, setPaused] = useState(false);
 const [loading, setLoading] = useState(false);
 const [needsTap, setNeedsTap] = useState(false);
 const [videoSource, setVideoSource] = useState<string | null>(null);
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
  const mobile = window.matchMedia('(max-width: 768px)');
  const update = () => {
   setEnabled(!preference.matches);
   setVideoSource(mobile.matches ? '/journey/horizon-mobile.mp4' : '/journey/horizon-web.mp4');
  };
  update();
  preference.addEventListener('change', update);
  mobile.addEventListener('change', update);
  return () => {
   preference.removeEventListener('change', update);
   mobile.removeEventListener('change', update);
  };
 }, []);

 useEffect(() => {
  if (!enabled) return;
  return activate();
 }, [enabled, videoSource, activate]);

 useEffect(() => {
  const media = video.current;
  const viewport = root.current;
  if (!enabled || !media || !viewport) return;
  // Track the road's vanishing point in the source, including the dissolve.
  const stops = [[0, .66], [1, .64], [2, .615], [3, .58], [4, .545], [4.5, .52], [5, .5], [5.5, .5]];
  const position = (time: number) => {
   if (!media.videoWidth || !media.videoHeight) return;
   let focal = stops[stops.length - 1][1];
   for (let i = 1; i < stops.length; i++) {
    if (time <= stops[i][0]) {
     const [start, from] = stops[i - 1];
     const [end, to] = stops[i];
     focal = from + (to - from) * Math.max(0, (time - start) / (end - start));
     break;
    }
   }
   const width = viewport.clientWidth;
   const scale = Math.max(width / media.videoWidth, viewport.clientHeight / media.videoHeight);
   const drawnWidth = media.videoWidth * scale;
   const overflow = drawnWidth - width;
   const percent = overflow > 1 ? Math.max(0, Math.min(1, (focal * drawnWidth - width / 2) / overflow)) * 100 : 50;
   media.style.objectPosition = `${percent}% center`;
  };
  const update = () => position(media.currentTime);
  let callback = 0;
  const onFrame: VideoFrameRequestCallback = (_, metadata) => {
   position(metadata.mediaTime);
   callback = media.requestVideoFrameCallback(onFrame);
  };
  if (typeof media.requestVideoFrameCallback === 'function') callback = media.requestVideoFrameCallback(onFrame);
  const observer = new ResizeObserver(update);
  observer.observe(viewport);
  media.addEventListener('loadeddata', update);
  media.addEventListener('seeked', update);
  update();
  return () => {
   observer.disconnect();
   media.removeEventListener('loadeddata', update);
   media.removeEventListener('seeked', update);
   if (callback) media.cancelVideoFrameCallback(callback);
  };
 }, [enabled]);

 useEffect(() => {
  const media = video.current;
  const story = root.current?.parentElement;
  if (!enabled || paused || failed || loading || !ready || !media || !story) return;
  const scrub = createScrubController({
   currentTime: () => media.currentTime,
   canSeek: () => media.readyState >= 2 && !media.seeking,
   seek: (time) => { media.currentTime = time; },
  });
  const update = () => {
   if (!Number.isFinite(media.duration) || media.duration <= 0) return;
   const range = Math.max(1, story.offsetHeight - root.current!.clientHeight);
   const travelled = Math.max(0, -story.getBoundingClientRect().top);
   const end = Math.max(0, media.duration - 1 / 24);
   scrub.update(scrollTime(travelled, range, end));
  };
  let animation = 0;
  const schedule = () => {
   if (animation) return;
   animation = requestAnimationFrame(() => { animation = 0; update(); });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(story);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  media.addEventListener('loadeddata', schedule);
  media.addEventListener('seeked', scrub.flush);
  schedule();
  return () => {
   cancelAnimationFrame(animation);
   observer.disconnect();
   window.removeEventListener('scroll', schedule);
   window.removeEventListener('resize', schedule);
   media.removeEventListener('loadeddata', schedule);
   media.removeEventListener('seeked', scrub.flush);
  };
 }, [enabled, paused, failed, loading, ready]);

 const controlLabel = loading ? 'Caricamento del viaggio' : !ready || needsTap ? 'Attiva il viaggio' : paused ? 'Riprendi il viaggio' : 'Vista statica';

 return <div ref={root} data-motion={enabled && !paused ? 'enabled' : 'reduced'} data-failed={failed} className={`journey-visual ${ready && enabled && !failed && !paused ? 'is-ready' : ''}`}>
  <picture className="journey-fallback"><source media="(max-width:768px)" srcSet="/journey/horizon-mobile.webp"/><img src="/journey/horizon.webp" alt="" width="1672" height="941" fetchPriority="high"/></picture>
  {enabled && videoSource && (
   <video ref={video} className="journey-video" src={videoSource} muted playsInline preload="auto" aria-hidden="true" onError={() => { setFailed(true); setLoading(false); }}/>
  )}
  <div className="journey-shade"/>
  <div className="journey-utility"><span aria-hidden="true">HORYZON <span className="utility-rule"/> UNA DIREZIONE CONDIVISA</span>{enabled && !failed && <button className="journey-utility-button motion-control" disabled={loading} onClick={() => { if (!ready || needsTap) activate(); else setPaused(!paused); }} aria-label={controlLabel} title={controlLabel} aria-pressed={paused}><span className="control-label">{loading ? 'Caricamento…' : !ready || needsTap ? 'Tocca per attivare il viaggio' : paused ? 'Attiva il viaggio' : 'Vista statica'}</span><svg className="journey-control-icon" viewBox="0 0 24 24" aria-hidden="true">{loading ? <circle cx="12" cy="12" r="3" fill="currentColor"/> : paused || !ready || needsTap ? <path d="M8 5.5v13l10-6.5z" fill="currentColor"/> : <><path d="M7.5 5.5h3.5v13H7.5z" fill="currentColor"/><path d="M13 5.5h3.5v13H13z" fill="currentColor"/></>}</svg></button>}<button className="journey-utility-button back-to-top-control" type="button" aria-label="Torna in alto" title="Torna in alto" onClick={() => scrollToPageTop(window.matchMedia('(prefers-reduced-motion: reduce)').matches)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>{failed && <p role="status">Video non disponibile. Puoi continuare a leggere il sito.</p>}</div>
 </div>;
}
