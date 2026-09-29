'use client';

import { HYC_PATHS } from './hyc-splash-paths';

// Loading splash for the home page: close-up on the HYC monogram, the camera pulls back to the full
// HORYZON CONSULTING logo, then the logo flies into the header wordmark while the overlay clears (2 s).
// Same choreography as the motion-lab spot hyc-splash-zoom. It is driven by an inline script that runs
// while the HTML is parsed, so it starts at first paint instead of waiting for hydration. It plays once
// per session, only on full page loads (the script does not run on client navigations), never with
// reduced motion, and any click, key or scroll skips it. The overlay stays display:none unless the
// script turns it on.
//
// The same script opts the home into its kinetic reveals (html.kinetic, see home-motion.tsx) before
// first paint, and tells the page when the logo is landing (window.__hycSplash + 'hyc:splash-landing')
// so the hero copy can enter as the overlay clears.

const LAYERS = [
 { id: 'hy', box: [60, 55, 615, 240] },
 { id: 'c', box: [60, 55, 615, 240] },
 { id: 'horyzon', box: [755, 52, 770, 132] },
 { id: 'consulting', box: [755, 238, 770, 78] },
] as const;

function playSplash() {
 const w = window as Window & { __hycSplash?: string; __homeMotion?: boolean };
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if (!reduced) {
  const html = document.documentElement;
  html.classList.add('kinetic');
  // If the page script never takes over, never leave the copy hidden.
  setTimeout(() => { if (!w.__homeMotion) html.classList.remove('kinetic'); }, 5000);
 }
 const root = document.getElementById('hyc-splash');
 if (!root || reduced) return;
 try {
  if (sessionStorage.getItem('hyc-splash')) return;
  sessionStorage.setItem('hyc-splash', '1');
 } catch {}
 w.__hycSplash = 'playing';

 const q = (id: string) => root.querySelector<HTMLElement | SVGElement>(`[data-splash="${id}"]`)!;
 const cam = q('cam'), dot = q('dot');
 const layers = [['hy', 0, .34, 1], ['c', .12, .46, -1], ['horyzon', .92, 1.36, 1], ['consulting', 1.02, 1.46, 1]]
  .map(([id, a, b, dir]) => ({ el: q(id as string), a: a as number, b: b as number, dir: dir as number }));
 const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
 const outQuart = (p: number) => 1 - (1 - p) ** 4;
 const outCubic = (p: number) => 1 - (1 - p) ** 3;
 const inOutCubic = (p: number) => p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
 const inOutQuart = (p: number) => p < .5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2;
 const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
 // monogram centre, full-logo centre, dot centre and widths in logo source pixels
 const MX = 366, MY = 175, LX = 793.5, LY = 184, DX = 369.2, DY = 169.1, MONO_W = 595, MONO_H = 221, LOGO_W = 1447;
 // header wordmark (/horyzon-logo-canonical.png, 1670x390): same artwork at 1.128x, dot centre at 349.5, 185.5
 const PNG_W = 1670, PNG_SCALE = 1.128, PNG_DX = 349.5, PNG_DY = 185.5;
 const FLY = [1.36, 1.84], END = 2;
 let start = 0, skipAt = 0, raf = 0, landed = false;
 let header: { s: number, x: number, y: number } | null | undefined;

 function land() {
  if (landed) return;
  landed = true;
  w.__hycSplash = 'landing';
  window.dispatchEvent(new Event('hyc:splash-landing'));
 }
 function headerTarget() {
  const logo = document.querySelector('.site-header .wordmark-logo');
  const r = logo?.getBoundingClientRect();
  if (!r || !r.width || window.scrollY > 0) return null;
  const k = r.width / PNG_W;
  return { s: PNG_SCALE * k, x: r.left + PNG_DX * k, y: r.top + PNG_DY * k };
 }
 function frame(now: number) {
  if (!start) start = now;
  const t = (now - start) / 1000;
  const W = window.innerWidth, H = window.innerHeight;
  const s0 = Math.min(W * .86 / MONO_W, H * .5 / MONO_H);
  const s1 = Math.min(W * .62, 560) / LOGO_W;
  const z = inOutQuart(seg(t, .52, 1.28));
  const drift = 1 + .045 * outCubic(seg(t, 0, .6)) * (1 - z);
  let s = Math.exp(lerp(Math.log(s0), Math.log(s1), z)) * drift;
  const x = lerp(W / 2, W / 2 + (MX - LX) * s1, z), y = lerp(H / 2, H / 2 + (MY - LY) * s1, z);
  // screen position of the dot; the fly-in moves it onto the header dot while scaling down
  let dx = x + (DX - MX) * s, dy = y + (DY - MY) * s;
  if (!skipAt && t >= FLY[0]) {
   if (header === undefined) { header = headerTarget(); land(); }
   if (header) {
    const f = inOutCubic(seg(t, FLY[0], FLY[1]));
    dx = lerp(dx, header.x, f); dy = lerp(dy, header.y, f);
    s = Math.exp(lerp(Math.log(s), Math.log(header.s), f));
   }
  }
  cam.style.transform = `translate(${dx - DX * s}px,${dy - DY * s}px) scale(${s})`;
  for (const l of layers) l.el.style.transform = `translateY(${l.dir * (1 - outQuart(seg(t, l.a, l.b))) * 102}%)`;
  const pd = seg(t, .34, .6);
  dot.style.transform = `scale(${1 + .32 * Math.sin(Math.PI * outCubic(pd)) * (1 - pd * .4)})`;
  // backdrop clears during the fly-in; the flying logo then hands over to the header wordmark
  let bg: number, alpha: number, stop: number;
  if (skipAt) {
   bg = alpha = 1 - seg(t, skipAt, skipAt + .25); stop = skipAt + .25;
  } else if (header === null) {
   bg = alpha = 1 - seg(t, 1.6, END); stop = END;
  } else {
   bg = 1 - seg(t, 1.5, FLY[1]); alpha = 1 - seg(t, FLY[1], END); stop = END;
  }
  root!.style.backgroundColor = `rgba(8,20,28,${bg})`;
  cam.style.opacity = String(alpha);
  if (t < stop) raf = requestAnimationFrame(frame);
  else finish();
 }
 function skip() {
  if (!skipAt && start) skipAt = (performance.now() - start) / 1000;
  land();
 }
 const events = ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const;
 function finish() {
  cancelAnimationFrame(raf);
  root!.style.display = 'none';
  land();
  w.__hycSplash = 'done';
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
