import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const alt='Horyzon — Diagnosi, organizzazione e progresso misurabile';
export const size={width:1200,height:630};
export const contentType='image/png';
// Same kit as the site: ink field, canonical logo (cream on dark), Manrope 800 title, JetBrains Mono label, lime accent.
// Fonts and logo are the files the Radar PDF already ships (src/lib/radar).
const asset=(...parts:string[])=>readFile(path.join(process.cwd(),'src/lib/radar',...parts));
export default async function Image(){
 const [manrope,mono,logo]=await Promise.all([asset('fonts','manrope-latin-800-normal.woff'),asset('fonts','jetbrains-mono-latin-500-normal.woff'),asset('assets','logo-crema.png')]);
 return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'72px 80px',background:'#07171d',backgroundImage:'linear-gradient(rgba(247,244,232,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(247,244,232,.04) 1px,transparent 1px)',backgroundSize:'120px 120px',color:'#f7f4e8',fontFamily:'Manrope'}}>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={`data:image/png;base64,${logo.toString('base64')}`} width={257} height={60} alt="Horyzon"/>
  <div style={{display:'flex',flexDirection:'column'}}>
   <div style={{fontSize:94,lineHeight:1,letterSpacing:'-0.045em'}}>Leggi l’impresa.</div>
   <div style={{fontSize:94,lineHeight:1.05,letterSpacing:'-0.045em',color:'#d8ff42'}}>Costruisci la direzione.</div>
  </div>
  <div style={{display:'flex',alignItems:'center',gap:18,fontFamily:'JetBrains Mono',fontSize:22,letterSpacing:'0.18em',textTransform:'uppercase',color:'#d8ff42'}}><div style={{width:14,height:14,borderRadius:7,background:'#d9e65f'}}/>Radar · Organizzazione · Evidenze</div>
 </div>,{...size,fonts:[{name:'Manrope',data:manrope,weight:800,style:'normal'},{name:'JetBrains Mono',data:mono,weight:500,style:'normal'}]});
}
