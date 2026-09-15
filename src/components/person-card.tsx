"use client";
import {useState} from 'react';
export function ShareCard(){const [message,setMessage]=useState('');async function share(){try{if(navigator.share){await navigator.share({title:document.title,url:location.href})}else{await navigator.clipboard.writeText(location.href);setMessage('Link copiato.')}}catch{setMessage('Puoi condividere il link dalla barra degli indirizzi.')}}return <><button className="button ghost-dark" onClick={share}>Condividi il biglietto ↗</button><p role="status">{message}</p></>}
