'use client';
import { useEffect, useState } from 'react';

const chapters = [
 ['orizzonte', 'Il tuo orizzonte'],
 ['presente', 'Leggere il presente'],
 ['organismo', 'L’organismo impresa'],
 ['percorso-operativo', 'Il percorso'],
 ['prossimo-orizzonte', 'Il prossimo passo'],
 ['persone-horyzon', 'Le persone e la visione'],
 ['parliamone', 'Parliamone'],
] as const;

export function ChapterNavigation() {
 const [active, setActive] = useState<string>('orizzonte');
 const [visible, setVisible] = useState(true);
 useEffect(() => {
  const sections = chapters.map(([id]) => document.getElementById(id));
  let frame = 0;
  const update = () => {
   frame = 0;
   const marker = Math.min(window.innerHeight * .35, 240);
   let current: string = chapters[0][0];
   for (const section of sections) {
    if (section && section.getBoundingClientRect().top <= marker) current = section.id;
   }
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

 return <nav className="chapter-navigation" aria-label="Sezioni della home" hidden={!visible}>
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
