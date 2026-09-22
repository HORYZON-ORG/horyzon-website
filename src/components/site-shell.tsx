"use client";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { RADAR_URL } from '@/content/product-truth';
const primaryLinks=[['I tre benesseri','/le-tre-aree'],['Come lavoriamo','/metodo'],['Horyzon','/horyzon'],['Contatti','/contatti']];
const footerGroups=[
 {title:'Inizia da qui',links:[["Radar d’Impresa",'/radar-impresa'],['AI Score','/ai-score'],['Trova il punto di partenza','/misura'],['Parliamone','/contatti']]},
 {title:'Costruisci il percorso',links:[['I tre benesseri','/le-tre-aree'],['Come lavoriamo','/metodo'],['Radar d’Impresa','/radar-impresa'],['Horyzon Platform','/piattaforma']]},
 {title:'Approfondisci',links:[['Horyzon','/horyzon'],['Persone','/persone'],['Biblioteca','/biblioteca'],['Management Umano','/libro/management-umano']]},
] as const;
export function Wordmark(){const path=usePathname();return <Link className="wordmark" href="/" aria-label="Horyzon, homepage" onClick={event=>{if(path==='/'&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}}}><span className="wordmark-logo-wrap"><Image className="wordmark-logo" src="/horyzon-logo-canonical.png" alt="Horyzon Consulting" width={1670} height={390} sizes="(max-width: 850px) 138px, 178px"/></span></Link>}
export function SiteHeader(){
 const path=usePathname();const [open,setOpen]=useState(false);const button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'auto'})},[path]);
 useEffect(()=>{if(!open)return; const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus()}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[open]);
 return <header className="site-header"><a className="skip-link" href="#content">Vai al contenuto</a><Wordmark/><nav id="site-navigation" aria-label="Navigazione principale" className={open?'site-links is-open':'site-links'}>{primaryLinks.map(([label,url])=><Link key={url} href={url} aria-current={path===url?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}<a className="join-link" href={RADAR_URL} onClick={()=>setOpen(false)}>Inizia il Radar ↗</a></nav><button ref={button} className="menu-toggle" aria-controls="site-navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Chiudi ×':'Menu ☰'}</button></header>
}
export function SiteFooter(){return <footer className="site-footer"><div className="footer-intro"><Wordmark/><p>Impresa · Economia · Umanità</p><p>Un orizzonte comune.<br/>Più spazio per ciò che conta.</p><Link className="footer-join" href="/entra-in-horyzon">Entra in Horyzon ↗</Link></div>{footerGroups.map(group=><nav key={group.title} aria-label={group.title} className="footer-path"><p>{group.title}</p>{group.links.map(([label,url])=><Link key={url} href={url}>{label}</Link>)}</nav>)}<div className="footer-company"><strong>FELICITÀ srl</strong><p>Viale Papiniano 28<br/>20123 Milano<br/>P. IVA 05120660757 · SDI SU9YNJA</p><a href="mailto:info@horyzon.it">info@horyzon.it ↗</a></div><small>© {new Date().getFullYear()} Horyzon Consulting <Link href="/privacy-policy">Privacy</Link><Link href="/cookie-policy">Cookie</Link></small></footer>}
