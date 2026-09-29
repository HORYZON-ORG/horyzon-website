'use client';
import { useLayoutEffect } from 'react';

// Kinetic layer for the home journey. Everything it does is gated on html.kinetic (set before first
// paint by the splash script, or here on client navigations) and skipped with reduced motion, so the
// server HTML, the readable Markdown export and the no-JS page stay exactly the static journey.
//
// - Chapter headings are split into words after hydration; each word rises out of its own mask and the
//   italic words land last. The rest of the chapter copy follows in order.
// - The hero waits for the splash logo to land in the header before it enters.
// - --dawn (0..1 over the journey) warms the scene; --m, --dot and data-step drive the pinned
//   "Come lavoriamo" track.

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
 if (copy.dataset.kin) return;
 copy.dataset.kin = '';
 let delay = 0;
 for (const child of [...copy.children] as HTMLElement[]) {
  if (/^H[12]$/.test(child.tagName)) {
   const words = splitWords(child, 0);
   child.style.setProperty('--d', `${delay + 80}ms`);
   delay += 80 + words * WORD_STAGGER + 260;
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
  const w = window as Window & { __hycSplash?: string; __homeMotion?: boolean };
  w.__homeMotion = true;
  document.documentElement.classList.add('kinetic');

  const chapters = [...document.querySelectorAll<HTMLElement>('.journey-chapter .chapter-copy')];
  chapters.forEach(prepareChapter);
  const hero = document.querySelector<HTMLElement>('.chapter-hero .chapter-copy');
  const reveal = (el: Element) => el.classList.add('is-in');

  const observer = new IntersectionObserver(entries => {
   for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    reveal(entry.target);
    observer.unobserve(entry.target);
   }
  }, { rootMargin: '0px 0px -18% 0px' });
  for (const copy of chapters) if (copy !== hero) observer.observe(copy);

  const enterHero = () => { if (hero) requestAnimationFrame(() => reveal(hero)); };
  if (w.__hycSplash === 'playing') window.addEventListener('hyc:splash-landing', enterHero, { once: true });
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
  return () => {
   cancelAnimationFrame(frame);
   observer.disconnect();
   window.removeEventListener('hyc:splash-landing', enterHero);
   window.removeEventListener('scroll', schedule);
   window.removeEventListener('resize', schedule);
  };
 }, []);
 return null;
}
