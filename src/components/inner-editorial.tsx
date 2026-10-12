import Image from 'next/image';

const directions: Record<string, { label: string; words: string[] }> = {
 'benessere-organizzativo': { label: 'Benessere organizzativo', words: ['Persone', 'Ruoli', 'Relazioni'] },
 'benessere-patrimoniale': { label: 'Benessere patrimoniale', words: ['Protezione', 'Equilibrio', 'Continuità'] },
 'benessere-digitale': { label: 'Benessere digitale', words: ['Dati', 'Strumenti', 'Competenze'] },
};
export function EditorialVisual({ page }: { page: string }) {
 const area = directions[page.split('/')[0]];
 const library = page === 'biblioteca' || page.includes('libro/');
 const human = page === 'persone' || page === 'entra-in-horyzon';
 const words = area?.words ?? (library ? ['Leggere', 'Comprendere', 'Evolvere'] : human ? ['Competenze', 'Incontri', 'Prospettive'] : ['Ascolto', 'Direzione', 'Cambiamento']);
 return <figure className={`editorial-visual ${library ? 'visual-library' : human ? 'visual-people' : 'visual-landscape'}`}>
  <div className="editorial-image"><Image src={library ? '/books/management.webp' : human ? '/people/angelo.webp' : page === 'horyzon' || page.startsWith('benessere-organizzativo') ? '/atlas/organismo.webp' : '/atlas/percorso.webp'} alt={library ? 'Management Umano, di Angelo Ria Chetta' : human ? 'Angelo Ria Chetta, fondatore di Horyzon' : ''} fill sizes="(max-width:850px) 90vw, 42vw" priority/>
   {!library && !human && <span className="visual-horizon" aria-hidden="true"/>}
  </div>
  <figcaption><span>{area?.label ?? (library ? 'La biblioteca Horyzon' : human ? 'Il valore degli incontri' : 'Una direzione condivisa')}</span><p>{words.map(word => <span key={word}>{word}</span>)}</p></figcaption>
 </figure>;
}
