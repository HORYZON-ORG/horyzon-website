'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createScrubController, journeyFocalPoint, scrollTime } from './scrub-controller';

export function Journey() {
 const root = useRef<HTMLDivElement>(null);
 const video = useRef<HTMLVideoElement>(null);
 const [enabled, setEnabled] = useState(false);
 const [ready, setReady] = useState(false);
 const [failed, setFailed] = useState(false);
 const [loading, setLoading] = useState(false);
 const [videoSource, setVideoSource] = useState<string | null>(null);
 const attempt = useRef(0);

 const markReady = useCallback(() => {
  const media = video.current;
  if (!media || media.readyState < 2) return;
  ++attempt.current;
  media.pause();
  setReady(true);
  setLoading(false);
 }, []);

 const activate = useCallback(() => {
  const media = video.current;
  if (!media) return () => {};
  const current = ++attempt.current;
  setLoading(true);
  media.muted = true;
  // Call play directly in the tap handler: Safari requires user activation.
  const playback = media.play();
  const timeout = window.setTimeout(() => {
   if (current !== attempt.current) return;
   ++attempt.current;
   media.pause();
   setLoading(false);
  }, 12000);
  void playback.then(() => {
   if (current !== attempt.current) return;
   // Decode a frame, then return control of the timeline to scrolling.
   media.pause();
   setReady(true);
   setLoading(false);
  }).catch(() => {
   if (current !== attempt.current) return;
   setLoading(false);
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
  // Track the generated horizon through both landscape and narrow crops.
  const position = (time: number) => {
   if (!media.videoWidth || !media.videoHeight) return;
   const width = viewport.clientWidth;
   const focal = journeyFocalPoint(time, width <= 768);
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
  if (!enabled || failed || loading || !ready || !media || !story) return;
  const scrub = createScrubController({
   currentTime: () => media.currentTime,
   canSeek: () => media.readyState >= 2 && !media.seeking,
   seek: (time) => { media.currentTime = time; },
  });
  const update = () => {
   const viewport = root.current;
   if (!viewport || !Number.isFinite(media.duration) || media.duration <= 0) return;
   const range = Math.max(1, story.offsetHeight - viewport.clientHeight);
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
 }, [enabled, failed, loading, ready]);

 return <div ref={root} data-motion={enabled ? 'enabled' : 'reduced'} data-failed={failed} className={`journey-visual ${ready && enabled && !failed ? 'is-ready' : ''}`}>
  <picture className="journey-fallback"><source media="(max-width:768px)" srcSet="/journey/horizon-mobile.webp"/><img src="/journey/horizon.webp" alt="" width="1672" height="941" fetchPriority="high"/></picture>
  {enabled && videoSource && (
   <video ref={video} className="journey-video" src={videoSource} muted playsInline preload="auto" aria-hidden="true" onLoadedData={markReady} onError={() => { setFailed(true); setLoading(false); }}/>
  )}
  <div className="journey-shade"/>
  {failed && <p className="journey-video-status" role="status">Video non disponibile. Puoi continuare a leggere il sito.</p>}
 </div>;
}
