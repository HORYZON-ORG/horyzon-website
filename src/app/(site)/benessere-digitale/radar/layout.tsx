import type {ReactNode} from 'react';
import type {Metadata} from 'next';
import Link from 'next/link';
import {SiteHeader,SiteFooter} from '@/components/site-shell';
import './radar.css';

export const metadata:Metadata={title:'Radar Benessere Digitale | Horyzon',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function DigitalRadarLayout({children}:{children:ReactNode}){
 return <><SiteHeader/><main id="content" className="rbd"><div className="rbd-wrap"><Link className="rbd-home" href="/benessere-digitale">Benessere Digitale Horyzon</Link>{children}</div></main><SiteFooter/></>;
}
