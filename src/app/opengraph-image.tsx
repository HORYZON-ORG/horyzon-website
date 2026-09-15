import {ImageResponse} from 'next/og';
export const alt='Horyzon Consulting — Guarda oltre. Ritrova spazio.';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:90,background:'#0a171e',color:'#f3f1e9'}}><div style={{fontSize:24,letterSpacing:8}}>HORYZON CONSULTING</div><div style={{fontSize:94,marginTop:50}}>Guarda oltre.</div><div style={{fontSize:94,color:'#d7ff3f'}}>Ritrova spazio.</div><div style={{fontSize:24,marginTop:40}}>Impresa · Economia · Umanità</div></div>,size)}
