'use client';
import { useEffect, useRef } from 'react';

// "Signals" over the journey video: points of light stream towards the horizon (a vanishing point at
// the video's horizon), faster while the page scrolls; near the pointer they link up like a network,
// and a pulse runs along the horizon line. Decorative only (aria-hidden). It never starts with reduced
// motion, sleeps while the journey is off screen or the tab is hidden, and keeps the DPR budget of
// DESIGN.md (1.5 desktop, 1.25 mobile). Particles live in typed arrays.

const COLORS = ['242,238,227', '242,238,227', '242,238,227', '217,191,143', '217,230,95'];

export function SignalField() {
 const canvas = useRef<HTMLCanvasElement>(null);

 useEffect(() => {
  const el = canvas.current;
  const story = el?.closest('.journey-story');
  if (!el || !story || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = el.getContext('2d');
  if (!ctx) return;

  const mobile = window.matchMedia('(max-width: 768px)').matches;
  const count = mobile ? 46 : 120;
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  const theta = new Float32Array(count), depth = new Float32Array(count), speed = new Float32Array(count), tint = new Uint8Array(count);
  const px = new Float32Array(count), py = new Float32Array(count);
  let W = 0, H = 0, vx = 0, vy = 0, reach = 0;
  const spawn = (i: number, initial: boolean) => {
   // mostly from below and the sides: the viewer's side of the horizon
   theta[i] = (-.15 + Math.random() * 1.3) * Math.PI;
   depth[i] = initial ? Math.random() : 1;
   speed[i] = .05 + Math.random() * .08;
   tint[i] = Math.floor(Math.random() * COLORS.length);
  };
  for (let i = 0; i < count; i++) spawn(i, true);

  const resize = () => {
   W = el.clientWidth; H = el.clientHeight;
   el.width = Math.round(W * dpr); el.height = Math.round(H * dpr);
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
   vx = W * .5; vy = H * (mobile ? .58 : .62);
   reach = Math.hypot(Math.max(vx, W - vx), Math.max(vy, H - vy)) * 1.1;
  };
  resize();

  let pointerX = -1e4, pointerY = -1e4, lastScroll = window.scrollY, boost = 0;
  const onPointer = (e: PointerEvent) => { pointerX = e.clientX; pointerY = e.clientY; };
  const onLeave = () => { pointerX = pointerY = -1e4; };

  let raf = 0, last = 0, visible = true, onScreen = true, pulse = 0;
  const frame = (now: number) => {
   raf = 0;
   const dt = Math.min(.05, last ? (now - last) / 1000 : 0);
   last = now;
   const scrolled = Math.abs(window.scrollY - lastScroll);
   lastScroll = window.scrollY;
   boost += (Math.min(5, scrolled / Math.max(dt, .001) / 350) - boost) * Math.min(1, dt * 5);

   ctx.clearRect(0, 0, W, H);
   ctx.globalCompositeOperation = 'lighter';
   ctx.lineCap = 'round';
   for (let i = 0; i < count; i++) {
    depth[i] -= speed[i] * (1 + boost) * dt;
    if (depth[i] <= .02) spawn(i, false);
    const z = depth[i];
    const r = reach * z * z, cx = Math.cos(theta[i]), cy = Math.sin(theta[i]);
    const x = vx + cx * r, y = vy + cy * r * .62;
    const tail = reach * Math.min(1, z + .012 + boost * .01) ** 2 - r;
    const alpha = Math.min(1, (1 - z) * 3) * Math.min(1, z * 2.2) * .55;
    ctx.strokeStyle = `rgba(${COLORS[tint[i]]},${alpha})`;
    ctx.lineWidth = .6 + z * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cx * tail, y + cy * tail * .62); ctx.stroke();
    px[i] = x; py[i] = y;
   }
   // network around the pointer
   if (pointerX > -1e3) {
    for (let i = 0; i < count; i++) {
     const d = Math.hypot(px[i] - pointerX, py[i] - pointerY);
     if (d > 150) continue;
     ctx.strokeStyle = `rgba(216,255,66,${(1 - d / 150) * .45})`;
     ctx.lineWidth = .7;
     ctx.beginPath(); ctx.moveTo(pointerX, pointerY); ctx.lineTo(px[i], py[i]); ctx.stroke();
    }
   }
   // a pulse running along the horizon line
   pulse = (pulse + dt * (.22 + boost * .08)) % 1;
   const hx = pulse * W;
   const glow = ctx.createLinearGradient(hx - 180, 0, hx + 180, 0);
   glow.addColorStop(0, 'rgba(217,230,95,0)'); glow.addColorStop(.5, 'rgba(217,230,95,.55)'); glow.addColorStop(1, 'rgba(217,230,95,0)');
   ctx.fillStyle = 'rgba(247,244,232,.07)'; ctx.fillRect(0, vy, W, 1);
   ctx.fillStyle = glow; ctx.fillRect(hx - 180, vy - .5, 360, 2);
   schedule();
  };
  const schedule = () => { if (!raf && visible && onScreen) raf = requestAnimationFrame(frame); };
  const pause = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };

  const observer = new IntersectionObserver(([entry]) => {
   onScreen = entry.isIntersecting;
   if (onScreen) schedule(); else pause();
  });
  observer.observe(story);
  const onVisibility = () => { visible = !document.hidden; if (visible) schedule(); else pause(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  schedule();
  return () => {
   pause();
   observer.disconnect();
   document.removeEventListener('visibilitychange', onVisibility);
   window.removeEventListener('resize', resize);
   window.removeEventListener('pointermove', onPointer);
   document.documentElement.removeEventListener('pointerleave', onLeave);
  };
 }, []);

 return <div className="signal-field" aria-hidden="true"><canvas ref={canvas}/></div>;
}
