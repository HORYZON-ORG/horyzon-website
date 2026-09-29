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
  const reveal = (el: Element) => el.classList.add('is-in');

  const observer = new IntersectionObserver(entries => {
   for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    reveal(entry.target);
    observer.unobserve(entry.target);
   }
  }, { rootMargin: '0px 0px -18% 0px' });
  for (const copy of chapters) if (copy !== hero) observer.observe(copy);
  document.querySelectorAll('[data-kin-watch]').forEach(el => observer.observe(el));

  const enterHero = () => {
   html.classList.remove('kin-hero');
   if (hero) requestAnimationFrame(() => reveal(hero));
  };
  if (heroPainted) hero?.classList.add('is-in');
  else if (w.__hycSplash === 'playing') window.addEventListener('hyc:splash-landing', enterHero, { once: true });
  else enterHero();

  const story = document.querySelector<HTMLElement>('.journey-story');
  const method = document.getElementById('come-lavoriamo');
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
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
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
   window.removeEventListener('resize', schedule);
   content?.removeEventListener('pointermove', onMove);
   content?.removeEventListener('pointerout', onLeave);
  };
 }, []);
 return null;
}
