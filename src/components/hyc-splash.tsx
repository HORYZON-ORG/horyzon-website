'use client';

import { HYC_PATHS } from './hyc-splash-paths';

// Loading splash for the home page: close-up on the HYC monogram, then the camera pulls back to the
// full HORYZON CONSULTING logo and the overlay fades into the page (2 s). Same choreography as the
// motion-lab spot hyc-splash-zoom. It is driven by an inline script that runs while the HTML is parsed,
// so it starts at first paint instead of waiting for hydration. It plays once per session, only on
// full page loads (the script does not run on client navigations), never with reduced motion, and any
// click, key or scroll skips it. The overlay stays display:none unless the script turns it on.

const LAYERS = [
 { id: 'hy', box: [60, 55, 615, 240] },
 { id: 'c', box: [60, 55, 615, 240] },
 { id: 'horyzon', box: [755, 52, 770, 132] },
 { id: 'consulting', box: [755, 238, 770, 78] },
] as const;

function playSplash() {
 const root = document.getElementById('hyc-splash');
 if (!root) return;
 try {
  if (sessionStorage.getItem('hyc-splash')) return;
  sessionStorage.setItem('hyc-splash', '1');
 } catch {}
 if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

 const q = (id: string) => root.querySelector<HTMLElement | SVGElement>(`[data-splash="${id}"]`)!;
 const cam = q('cam'), dot = q('dot');
 const layers = [['hy', 0, .34, 1], ['c', .12, .46, -1], ['horyzon', .92, 1.36, 1], ['consulting', 1.02, 1.46, 1]]
  .map(([id, a, b, dir]) => ({ el: q(id as string), a: a as number, b: b as number, dir: dir as number }));
 const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
 const outQuart = (p: number) => 1 - (1 - p) ** 4;
 const outCubic = (p: number) => 1 - (1 - p) ** 3;
 const inOutQuart = (p: number) => p < .5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2;
 const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
 // monogram centre, full-logo centre and widths in logo source pixels
 const MX = 366, MY = 175, LX = 793.5, LY = 184, MONO_W = 595, MONO_H = 221, LOGO_W = 1447;
 const END = 2, FADE = 1.6;
 let start = 0, skipAt = 0, raf = 0;

 function frame(now: number) {
  if (!start) start = now;
  const t = (now - start) / 1000;
  const W = window.innerWidth, H = window.innerHeight;
  const s0 = Math.min(W * .86 / MONO_W, H * .5 / MONO_H);
  const s1 = Math.min(W * .62, 560) / LOGO_W;
  const z = inOutQuart(seg(t, .52, 1.28));
  const drift = 1 + .045 * outCubic(seg(t, 0, .6)) * (1 - z);
  const s = Math.exp(lerp(Math.log(s0), Math.log(s1), z)) * drift;
  const x = lerp(W / 2, W / 2 + (MX - LX) * s1, z), y = lerp(H / 2, H / 2 + (MY - LY) * s1, z);
  cam.style.transform = `translate(${x - MX * s}px,${y - MY * s}px) scale(${s})`;
  for (const l of layers) l.el.style.transform = `translateY(${l.dir * (1 - outQuart(seg(t, l.a, l.b))) * 102}%)`;
  const pd = seg(t, .34, .6);
  dot.style.transform = `scale(${1 + .32 * Math.sin(Math.PI * outCubic(pd)) * (1 - pd * .4)})`;
  const fadeFrom = skipAt || FADE, fadeLen = skipAt ? .25 : END - FADE;
  root!.style.opacity = String(1 - seg(t, fadeFrom, fadeFrom + fadeLen));
  if (t < fadeFrom + fadeLen) raf = requestAnimationFrame(frame);
  else finish();
 }
 function skip() {
  if (!skipAt && start) skipAt = Math.min((performance.now() - start) / 1000, FADE);
 }
 const events = ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const;
 function finish() {
  cancelAnimationFrame(raf);
  root!.style.display = 'none';
  for (const e of events) window.removeEventListener(e, skip);
 }
 for (const e of events) window.addEventListener(e, skip, { passive: true });
 root.style.display = 'block';
 raf = requestAnimationFrame(frame);
}

export function HycSplash() {
 return <>
  <div id="hyc-splash" className="hyc-splash" aria-hidden="true" suppressHydrationWarning>
   <div className="hyc-splash-cam" data-splash="cam" suppressHydrationWarning>
    {LAYERS.map(({ id, box: [x, y, w, h] }) => <div key={id} className="hyc-splash-mask" style={{ left: x, top: y, width: w, height: h }}>
     <svg data-splash={id} viewBox={`${x} ${y} ${w} ${h}`} suppressHydrationWarning>
      <path fillRule="evenodd" d={HYC_PATHS[id]} />
      {id === 'hy' && <circle className="hyc-splash-dot" data-splash="dot" cx="369.2" cy="169.1" r="27.8" suppressHydrationWarning />}
     </svg>
    </div>)}
   </div>
  </div>
  <script type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(${playSplash.toString()})()` }} />
 </>;
}
