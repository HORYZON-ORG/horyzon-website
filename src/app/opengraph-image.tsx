import {ImageResponse} from 'next/og';
export const alt='Horyzon — Diagnosi, organizzazione e progresso misurabile';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:90,background:'#0a171e',color:'#f3f1e9'}}><div style={{fontSize:24,letterSpacing:8}}>HORYZON</div><div style={{fontSize:88,marginTop:50}}>Leggi l’impresa.</div><div style={{fontSize:88,color:'#d9bf8f'}}>Costruisci la direzione.</div><div style={{fontSize:24,marginTop:40}}>Radar · Organizzazione · Evidenze</div></div>,size)}
