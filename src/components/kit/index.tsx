// Page kit: the building blocks every inner page is made of (styles in src/styles/horyzon-kit.css).
// Server components only; motion is CSS (mask titles, view() reveals) and the HTML is complete without JavaScript.
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const order = (i: number) => ({ '--i': i }) as CSSProperties;
const internal = (href: string) => href.startsWith('/') && !href.startsWith('//');
export type Tone = 'ink' | 'panel' | 'lime' | 'cream' | 'sand';

/** A title split on its last sentence: with more than one sentence the last one is set in the accent colour. */
export function accentLast(title: string): ReactNode {
 const match = title.match(/^(.*[.!?])\s+([^.!?]+[.!?]?)$/);
 return match ? <>{match[1]} <em>{match[2]}</em></> : title;
}

export function Cta({ href, children, arrow = '↗︎', className = 'rd-cta', ...rest }: { href: string; children: ReactNode; arrow?: string | null; className?: string } & Record<`data-${string}`, string>) {
 const content = <>{children}{arrow && <span aria-hidden="true">{arrow}</span>}</>;
 return internal(href) ? <Link className={className} href={href} {...rest}>{content}</Link> : <a className={className} href={href} {...rest}>{content}</a>;
}
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
 return <Cta href={href} className="rd-link" arrow={null}>{children}</Cta>;
}

export type Crumb = { name: string; href?: string };
export function Breadcrumb({ items }: { items: Crumb[] }) {
 return <nav className="rd-crumbs" aria-label="Percorso di navigazione">{items.map((item, index) => <span key={`${item.name}-${index}`} style={{ display: 'contents' }}>{index > 0 && <span aria-hidden="true">/</span>}{item.href ? <Link href={item.href}>{item.name}</Link> : <span aria-current="page">{item.name}</span>}</span>)}</nav>;
}

export function PageHero({ crumbs, label, title, lead, children, aside, className = '' }: { crumbs?: Crumb[]; label?: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode; aside?: ReactNode; className?: string }) {
 return <section className={`rd-hero rd-hero-page ${aside ? '' : 'rd-hero-solo'} ${className}`}>
  <div className="rd-hero-copy">
   {crumbs && <Breadcrumb items={crumbs} />}
   {label && <p className="rd-label rd-rise">{label}</p>}
   <h1><span className="rd-mask"><span className="rd-line" style={delay(120)}>{title}</span></span></h1>
   {lead && <p className="rd-lead rd-rise" style={delay(420)}>{lead}</p>}
   {children && <div className="rd-actions rd-rise" style={delay(560)}>{children}</div>}
  </div>
  {aside && <div className="rd-hero-aside">{aside}</div>}
 </section>;
}

/** Hero card for inner pages: a mono caption and three words, the last one lit. */
export function HeroIndex({ caption, words, note }: { caption: string; words: readonly string[]; note?: string }) {
 return <figure className="rd-index"><figcaption>{caption}</figcaption><ol>{words.map((word, index) => <li key={word}><b aria-hidden="true">0{index + 1}</b><span>{word}</span></li>)}</ol>{note && <p>{note}</p>}</figure>;
}

export function Section({ id, tone, className = '', label, title, lead, split = false, children, headingId }: { id?: string; tone?: Tone; className?: string; label?: ReactNode; title?: ReactNode; lead?: ReactNode; split?: boolean; children?: ReactNode; headingId?: string }) {
 const head = (label || title || lead) && <header className="rd-head rd-reveal">{label && <p className="rd-label">{label}</p>}{title && <h2 id={headingId} className="rd-h2">{title}</h2>}{lead && <p className="rd-head-lead">{lead}</p>}</header>;
 return <section id={id} className={`rd-section ${tone ? `rd-tone-${tone}` : ''} ${className}`} aria-labelledby={title && headingId ? headingId : undefined}>
  {split ? <div className="rd-split">{head}<div>{children}</div></div> : <>{head}{children}</>}
 </section>;
}

export type Tile = { tag?: string; title: ReactNode; text?: ReactNode; href?: string; more?: string; className?: string };
export function Tiles({ items, columns = 3 }: { items: readonly Tile[]; columns?: 2 | 3 }) {
 return <ul className={`rd-tiles ${columns === 2 ? 'rd-tiles-2' : ''}`}>{items.map((item, index) => {
  const body = <>{item.tag && <span className="rd-tile-tag" aria-hidden={/^\d+$/.test(item.tag) || undefined}>{item.tag}</span>}<h3>{item.title}</h3>{item.text && <p>{item.text}</p>}{item.more && <span className="rd-tile-more">{item.more} <span aria-hidden="true">↗︎</span></span>}</>;
  return <li key={index}>{item.href ? (internal(item.href) ? <Link className={`rd-tile rd-reveal ${item.className ?? ''}`} style={order(index)} href={item.href}>{body}</Link> : <a className={`rd-tile rd-reveal ${item.className ?? ''}`} style={order(index)} href={item.href}>{body}</a>) : <div className={`rd-tile rd-reveal ${item.className ?? ''}`} style={order(index)}>{body}</div>}</li>;
 })}</ul>;
}

export type Row = { title?: ReactNode; text: ReactNode; href?: string; className?: string; tag?: string; lit?: boolean };
export function Rows({ items, start = 1, ordered = true, className = '' }: { items: readonly Row[]; start?: number; ordered?: boolean; className?: string }) {
 const List = ordered ? 'ol' : 'ul';
 const tagged = items.some(item => item.tag);
 return <List className={`rd-rows ${tagged ? 'rd-rows-tagged' : ''} ${className}`} start={ordered && start !== 1 ? start : undefined}>{items.map((item, index) => {
  const n = item.tag ? <span className={`rd-row-tag ${item.lit ? 'is-lit' : ''}`}>{item.tag}</span> : <span className="rd-row-n" aria-hidden="true">{String(start + index).padStart(2, '0')}</span>;
  const body = item.title ? <div><h3>{item.title}</h3><p>{item.text}</p></div> : <p className="rd-row-text">{item.text}</p>;
  return <li key={index}>{item.href ? (() => { const inner = <>{n}{body}<span className="rd-row-go" aria-hidden="true">↗︎</span></>; const cls = `rd-row rd-reveal ${item.className ?? ''}`; return internal(item.href) ? <Link className={cls} style={order(index)} href={item.href}>{inner}</Link> : <a className={cls} style={order(index)} href={item.href}>{inner}</a>; })() : <div className={`rd-row rd-reveal ${item.className ?? ''}`} style={order(index)}>{n}{body}{!tagged && <span />}</div>}</li>;
 })}</List>;
}

export function Points({ items }: { items: readonly ReactNode[] }) {
 return <ul className="rd-points">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

export function PageFinal({ label = 'Il prossimo passo', title, text, children, className = '' }: { label?: ReactNode; title: ReactNode; text?: ReactNode; children?: ReactNode; className?: string }) {
 return <section className={`rd-final rd-final-glow ${className}`}><p className="rd-label">{label}</p><h2 className="rd-reveal">{title}</h2>{text && <p>{text}</p>}{children && <div className="rd-actions" style={{ justifyContent: 'center', marginTop: 4 }}>{children}</div>}</section>;
}
