'use client';
import { useEffect, useRef, useState } from 'react';

const chapters = [
 ['orizzonte', 'Il tuo orizzonte'],
 ['radar', 'Inizia dal Radar'],
 ['tre-benesseri', 'I tre benesseri'],
 ['organigramma', 'L’organigramma'],
 ['come-lavoriamo', 'Come lavoriamo'],
 ['parliamone', 'Parliamone'],
] as const;

// The horizon line: chapters sit on a line along the bottom of the viewport and a lime point (the dot of
// the logo) travels along it with the reading position. --p is updated per frame without re-rendering.
export function ChapterNavigation() {
 const nav = useRef<HTMLElement>(null);
 const [active, setActive] = useState<string>('orizzonte');
 const [visible, setVisible] = useState(true);
 useEffect(() => {
  const sections = chapters.map(([id]) => document.getElementById(id));
  let frame = 0;
  const update = () => {
   frame = 0;
   const marker = Math.min(window.innerHeight * .35, 240);
   let current: string = chapters[0][0];
   const tops = sections.map(section => section ? section.getBoundingClientRect().top : Infinity);
   let progress = 0;
   tops.forEach((top, index) => {
    if (top > marker) return;
    current = chapters[index][0];
    const next = tops[index + 1];
    progress = index + (Number.isFinite(next) ? Math.min(1, (marker - top) / Math.max(1, next - top)) : 0);
   });
   nav.current?.style.setProperty('--p', (progress / (chapters.length - 1)).toFixed(4));
   setActive(current);
   const last = sections[sections.length - 1];
   setVisible(!last || last.getBoundingClientRect().bottom > marker);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const observer = new ResizeObserver(schedule);
  sections.forEach(section => { if (section) observer.observe(section); });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
  return () => {
   cancelAnimationFrame(frame);
   observer.disconnect();
   window.removeEventListener('scroll', schedule);
   window.removeEventListener('resize', schedule);
  };
 }, []);

 return <nav ref={nav} className="chapter-navigation horizon-nav" aria-label="Sezioni della home" hidden={!visible}>
  <span className="horizon-nav-line" aria-hidden="true"><i/></span>
  {chapters.map(([id, label]) => <a key={id} href={`#${id}`} aria-label={label} aria-current={active === id ? 'location' : undefined}
   onClick={event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const header = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 84;
    window.scrollTo({ top: id === 'orizzonte' ? 0 : window.scrollY + section.getBoundingClientRect().top - header - 16, behavior: reduced ? 'instant' : 'smooth' });
   }}><span className="chapter-dot" aria-hidden="true"/><span className="chapter-dot-label" aria-hidden="true">{label}</span></a>)}
 </nav>;
}
