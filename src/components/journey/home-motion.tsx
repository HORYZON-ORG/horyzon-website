'use client';
import { useLayoutEffect } from 'react';

// Kinetic layer for the home journey. Everything it does is gated on html.kinetic (set before first
// paint by the splash script, or here on client navigations) and skipped with reduced motion, so the
// server HTML, the readable Markdown export and the no-JS page stay exactly the static journey.
//
// - Chapter headings are split into words after hydration; each word rises out of its own mask and the
//   italic words land last. The rest of the chapter copy follows in order; path lists enter item by item.
// - The hero waits for the splash logo to land in the header. On a full load without the splash it was
//   already painted, so it is left as is (window.__kinStatic).
// - Decorative scenes ([data-kin-watch]: radar, arrival horizon) start when they enter the viewport.
// - --dawn (0..1 over the journey) warms the scene; --m, --dot and data-step drive the pinned
//   "Come lavoriamo" track.
// - The organisation chart (#organigramma) is pinned on large screens: --bus and data-lit build it by
//   scroll; on small screens each department enters on its own.
// - Chapter labels decode from random characters when their chapter enters.
// - Buttons lean towards the pointer and path cards carry a light that follows it (--mx/--my, --gx/--gy).

type MotionWindow = Window & { __hycSplash?: string; __homeMotion?: boolean; __kinStatic?: boolean };

const WORD_STAGGER = 55;

function splitWords(heading: HTMLElement, first: number) {
 let index = first;
 const walk = (node: Node) => {
  for (const child of [...node.childNodes]) {
   if (child.nodeType === Node.TEXT_NODE) {
    const parts = (child.textContent ?? '').split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
     if (!part) continue;
     if (/^\s+$/.test(part)) { fragment.append(part); continue; }
     const mask = document.createElement('span');
     const word = document.createElement('span');
     mask.className = 'kin-m';
     word.className = 'kin-w';
     word.style.setProperty('--i', String(index++));
     word.textContent = part;
     mask.append(word);
     fragment.append(mask);
    }
    child.replaceWith(fragment);
   } else if (child.nodeType === Node.ELEMENT_NODE && !(child as Element).classList.contains('kin-m')) walk(child);
  }
 };
 walk(heading);
 return index - first;
}

function prepareChapter(copy: HTMLElement) {
 if (copy.dataset.kin !== undefined) return;
 copy.dataset.kin = '';
 let delay = 0;
 for (const child of [...copy.children] as HTMLElement[]) {
  if (/^H[12]$/.test(child.tagName)) {
   const words = splitWords(child, 0);
   child.style.setProperty('--d', `${delay + 80}ms`);
   delay += 80 + words * WORD_STAGGER + 260;
  } else if (child.classList.contains('dimension-paths')) {
   // the rule above the paths draws first, then the paths arrive one by one
   child.classList.add('kin-paths');
   child.style.setProperty('--d', `${delay}ms`);
   delay += 250;
   for (const item of [...child.children] as HTMLElement[]) {
    item.classList.add('kin-fade');
    item.style.setProperty('--d', `${delay}ms`);
    delay += 160;
   }
  } else {
   child.classList.add('kin-fade');
   child.style.setProperty('--d', `${delay}ms`);
   delay += 120;
  }
 }
}

// Pinned method track: the lime dot travels to each of the three stops (1/6, 1/2, 5/6 of the line)
// and rests there while that step is read.
const METHOD_STOPS = [[0, .12, 0, 1 / 6], [.3, .45, 1 / 6, .5], [.63, .78, .5, 5 / 6]] as const;
function methodTrack(m: number) {
 let dot = 0, step = 0;
 for (const [from, to, a, b] of METHOD_STOPS) {
  if (m < from) break;
  const p = Math.min(1, (m - from) / (to - from));
  dot = a + (b - a) * p * p * (3 - 2 * p);
  if (p > .6) step++;
 }
 return { dot, step };
}

// Organisation chart: direction first, then the connector, then the five departments one by one.
function orgTrack(m: number) {
 const clamp = (x: number) => Math.min(1, Math.max(0, x));
 const bus = clamp((m - .06) / .14);
 let lit = 0;
 for (let k = 0; k < 5; k++) if (m >= .22 + k * .12) lit = k + 1;
 return { head: m > .02, bus, lit, note: m >= .8 };
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// Resolve a label from random glyphs, left to right. Only text nodes change; spaces and marks stay.
function decode(label: HTMLElement) {
 const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
 const nodes: [Text, string][] = [];
 while (walker.nextNode()) nodes.push([walker.currentNode as Text, walker.currentNode.textContent ?? '']);
 const total = nodes.reduce((n, [, text]) => n + text.length, 0);
 const start = performance.now(), duration = 520 + total * 14;
 const step = (now: number) => {
  const p = Math.min(1, (now - start) / duration);
  let offset = 0;
  for (const [node, text] of nodes) {
   node.textContent = [...text].map((ch, i) => {
    const at = (offset + i) / Math.max(1, total);
    return p >= at * .8 + .2 || !/[\p{L}\p{N}]/u.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
   }).join('');
   offset += text.length;
  }
  if (p < 1) requestAnimationFrame(step);
 };
 requestAnimationFrame(step);
}

export function HomeMotion() {
 useLayoutEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const w = window as MotionWindow;
  const html = document.documentElement;
  const heroPainted = w.__kinStatic === true;
  w.__kinStatic = false;
  w.__homeMotion = true;
  html.classList.add('kinetic');

  const hero = document.querySelector<HTMLElement>('.chapter-hero .chapter-copy');
  const chapters = [...document.querySelectorAll<HTMLElement>('.journey-chapter .chapter-copy')];
  for (const copy of chapters) {
   if (copy === hero && heroPainted) copy.dataset.kin = '';
   else prepareChapter(copy);
  }
  const reveal = (el: Element) => {
   if (el.classList.contains('is-in')) return;
   el.classList.add('is-in');
   const label = el.classList.contains('chapter-copy') ? el.querySelector<HTMLElement>('.chapter-label') : null;
   if (label) setTimeout(() => decode(label), parseInt(label.style.getPropertyValue('--d')) || 0);
  };

  const observer = new IntersectionObserver(entries => {
   for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    reveal(entry.target);
    observer.unobserve(entry.target);
   }
  }, { rootMargin: '0px 0px -18% 0px' });
  for (const copy of chapters) if (copy !== hero) observer.observe(copy);
  document.querySelectorAll('[data-kin-watch], .org-depts > li, .org-note').forEach(el => observer.observe(el));

  const enterHero = () => {
   html.classList.remove('kin-hero');
   if (hero) requestAnimationFrame(() => reveal(hero));
  };
  if (heroPainted) hero?.classList.add('is-in');
  else if (w.__hycSplash === 'playing') window.addEventListener('hyc:splash-landing', enterHero, { once: true });
  else enterHero();

  const story = document.querySelector<HTMLElement>('.journey-story');
  const method = document.getElementById('come-lavoriamo');
  const org = document.getElementById('organigramma');
  let frame = 0;
  const update = () => {
   frame = 0;
   const vh = window.innerHeight;
   if (story) {
    const rect = story.getBoundingClientRect();
    const dawn = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - vh)));
    story.style.setProperty('--dawn', dawn.toFixed(4));
   }
   if (method) {
    const rect = method.getBoundingClientRect();
    const m = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - vh)));
    const { dot, step } = methodTrack(m);
    method.style.setProperty('--m', m.toFixed(4));
    method.style.setProperty('--dot', dot.toFixed(4));
    method.dataset.step = String(step);
   }
   if (org) {
    const rect = org.getBoundingClientRect();
    const { head, bus, lit, note } = orgTrack(Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - vh))));
    org.style.setProperty('--bus', bus.toFixed(4));
    org.dataset.lit = String(lit);
    org.toggleAttribute('data-head', head);
    org.toggleAttribute('data-note', note);
   }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  // The pinned chart must fit between the header and the horizon line: scale it down when needed.
  const orgPin = org?.querySelector<HTMLElement>('.org-pin');
  const orgStage = org?.querySelector<HTMLElement>('.org-stage');
  const fit = () => {
   if (!orgPin || !orgStage) return;
   const style = getComputedStyle(orgPin);
   if (style.position !== 'sticky') { orgStage.style.removeProperty('--fit'); return; }
   const room = orgPin.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
   orgStage.style.setProperty('--fit', Math.min(1, room / Math.max(1, orgStage.offsetHeight)).toFixed(3));
  };
  const onResize = () => { fit(); schedule(); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', onResize);
  fit();
  void document.fonts?.ready.then(fit);
  update();

  // Pointer details, only for precise pointers.
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const content = document.querySelector<HTMLElement>('.journey-content');
  const onMove = (event: PointerEvent) => {
   const target = event.target as Element | null;
   const button = target?.closest<HTMLElement>('.journey-button');
   if (button) {
    const r = button.getBoundingClientRect();
    button.style.setProperty('--mx', `${((event.clientX - r.left) / r.width - .5) * 10}px`);
    button.style.setProperty('--my', `${((event.clientY - r.top) / r.height - .5) * 8}px`);
   }
   const card = target?.closest<HTMLElement>('.dimension-paths a');
   if (card) {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--gx', `${event.clientX - r.left}px`);
    card.style.setProperty('--gy', `${event.clientY - r.top}px`);
   }
  };
  const onLeave = (event: PointerEvent) => {
   const button = (event.target as Element | null)?.closest<HTMLElement>('.journey-button');
   if (button && !button.contains(event.relatedTarget as Node | null)) {
    button.style.removeProperty('--mx');
    button.style.removeProperty('--my');
   }
  };
  if (fine && content) {
   content.addEventListener('pointermove', onMove);
   content.addEventListener('pointerout', onLeave);
  }

  return () => {
   cancelAnimationFrame(frame);
   observer.disconnect();
   window.removeEventListener('hyc:splash-landing', enterHero);
   window.removeEventListener('scroll', schedule);
   window.removeEventListener('resize', onResize);
   content?.removeEventListener('pointermove', onMove);
   content?.removeEventListener('pointerout', onLeave);
  };
 }, []);
 return null;
}
