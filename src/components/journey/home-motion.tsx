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
// - --dawn (0..1 over the journey) warms the scene.
// - "Come lavoriamo" and the organisation chart play their sequence once they are on screen (data-step
//   and --dot; data-head, --bus, data-lit, data-note): one scroll per chapter, no scroll-scrubbing.
//   On small screens each department also enters on its own.
// - Chapter labels decode from random characters when their chapter enters.
// - Wheel paging on desktop: one wheel or trackpad gesture moves to the next or previous chapter; the
//   FAQ and the footer below the journey scroll natively. Keyboard, scrollbar and touch stay native.
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

// Sequences that play by themselves once their chapter is on screen: one scroll lands on the chapter
// and the whole build runs in about 1.5 s. Each step is [delay ms, apply].
type Step = [number, (el: HTMLElement) => void];
const METHOD_SEQUENCE: Step[] = [1, 2, 3].map((step, i) => [250 + i * 620, el => {
 el.dataset.step = String(step);
 el.style.setProperty('--dot', String((2 * step - 1) / 6));
}]);
const ORG_SEQUENCE: Step[] = [
 [0, el => el.toggleAttribute('data-head', true)],
 [220, el => el.style.setProperty('--bus', '1')],
 ...[1, 2, 3, 4, 5].map((lit, i): Step => [520 + i * 170, el => { el.dataset.lit = String(lit); }]),
 [1500, el => el.toggleAttribute('data-note', true)],
];
function play(el: HTMLElement, steps: Step[], timers: number[]) {
 if (el.dataset.played !== undefined) return;
 el.dataset.played = '';
 for (const [delay, apply] of steps) timers.push(window.setTimeout(() => apply(el), delay));
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
  const timers: number[] = [];
  const sequences = new IntersectionObserver(entries => {
   for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target as HTMLElement;
    play(el, el === org ? ORG_SEQUENCE : METHOD_SEQUENCE, timers);
    sequences.unobserve(el);
   }
  }, { threshold: .45 });
  for (const el of [method, org]) if (el) sequences.observe(el);

  let frame = 0;
  const update = () => {
   frame = 0;
   if (!story) return;
   const rect = story.getBoundingClientRect();
   const dawn = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - window.innerHeight)));
   story.style.setProperty('--dawn', dawn.toFixed(4));
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  // On large screens the chart holds one screen: scale it down when the viewport is short.
  const orgPin = org?.querySelector<HTMLElement>('.org-pin');
  const orgStage = org?.querySelector<HTMLElement>('.org-stage');
  const large = window.matchMedia('(min-width: 851px) and (min-height: 720px)');
  const fit = () => {
   if (!orgPin || !orgStage) return;
   if (!large.matches) { orgStage.style.removeProperty('--fit'); return; }
   const style = getComputedStyle(orgPin);
   const room = orgPin.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
   orgStage.style.setProperty('--fit', Math.min(1, room / Math.max(1, orgStage.offsetHeight)).toFixed(3));
  };
  const onResize = () => { fit(); schedule(); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', onResize);
  fit();
  void document.fonts?.ready.then(fit);
  update();

  // Wheel paging (desktop, precise pointers): chapter tops are the pages, the FAQ top is the last one.
  const desktop = window.matchMedia('(min-width: 851px) and (hover: hover) and (pointer: fine)');
  const pages = () => {
   const tops = [...document.querySelectorAll<HTMLElement>('.journey-chapter')].map((s, i) => i === 0 ? 0 : Math.round(s.getBoundingClientRect().top + window.scrollY));
   const faq = document.querySelector<HTMLElement>('.horyzon-home .faq-section');
   if (faq) tops.push(Math.round(faq.getBoundingClientRect().top + window.scrollY));
   return tops;
  };
  let paging = 0, pageTimer = 0, lastWheel = 0, travel = 0;
  const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const glide = (to: number) => {
   const from = window.scrollY, start = performance.now(), duration = 900;
   const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' });
    if (t < 1) paging = requestAnimationFrame(step);
    else paging = 0;
   };
   paging = requestAnimationFrame(step);
  };
  const onWheel = (event: WheelEvent) => {
   if (!desktop.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
   const now = performance.now(), gap = now - lastWheel;
   lastWheel = now;
   const tops = pages(), y = window.scrollY, last = tops[tops.length - 1], down = event.deltaY > 0;
   // below the journey the page scrolls natively; coming back up from the FAQ top re-enters paging
   if (y > last + 2 || (down && y >= last - 2)) return;
   event.preventDefault();
   // a gesture keeps the page locked until it stops (trackpad momentum included)
   if (paging || (pageTimer && gap < 160)) { window.clearTimeout(pageTimer); pageTimer = window.setTimeout(() => { pageTimer = 0; }, 160); return; }
   travel += event.deltaY;
   if (Math.abs(travel) < 24) return;
   const target = down ? tops.find(t => t > y + 4) : [...tops].reverse().find(t => t < y - 4);
   travel = 0;
   if (target === undefined) return;
   glide(target);
   pageTimer = window.setTimeout(() => { pageTimer = 0; }, 160);
  };
  window.addEventListener('wheel', onWheel, { passive: false });

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
   sequences.disconnect();
   timers.forEach(clearTimeout);
   window.removeEventListener('wheel', onWheel);
   cancelAnimationFrame(paging);
   window.clearTimeout(pageTimer);
   window.removeEventListener('hyc:splash-landing', enterHero);
   window.removeEventListener('scroll', schedule);
   window.removeEventListener('resize', onResize);
   content?.removeEventListener('pointermove', onMove);
   content?.removeEventListener('pointerout', onLeave);
  };
 }, []);
 return null;
}
