import type { PublicFaq } from '@/content/public-faq';

export const recruitingTitle = 'Recruiting e selezione del personale | Horyzon Consulting';
export const recruitingDescription = 'Affianchiamo imprenditori e aziende nel recruiting: chiarezza del ruolo, attrazione, valutazione e inserimento delle persone, con metodologia e strumenti Performia.';
export const recruitingContact = 'mailto:info@horyzon.it?subject=' + encodeURIComponent('Confronto sul recruiting della mia azienda') + '&body=' + encodeURIComponent('Buongiorno,\nvorrei un confronto sulla selezione di una persona.\n\nAzienda e settore:\nRuolo da inserire:\nSede di lavoro:\nDifficoltà che stiamo incontrando:\nTempistiche desiderate:\nNome e recapito:\n');

export const recruitingFaqs: readonly PublicFaq[] = [
 { question: 'Ricevo molti curriculum ma pochi candidati adatti: da dove parto?', answer: 'Dalla definizione del ruolo: risultati attesi, attività, requisiti e condizioni offerte. Poi si valuta se annuncio, canali e criteri di selezione stanno raggiungendo le persone pertinenti.' },
 { question: 'Posso contattarvi per una sola posizione?', answer: 'Puoi presentarci anche una singola posizione. Nel primo confronto valutiamo la situazione e definiamo quali attività siano pertinenti: annuncio, valutazione, affiancamento alla selezione o inserimento.' },
 { question: 'Quanto costa il supporto al recruiting?', answer: 'Il costo dipende da ruolo, difficoltà e attività concordate. Prima di iniziare vanno chiariti perimetro, responsabilità e condizioni economiche. Puoi descrivere la ricerca a info@horyzon.it per approfondire il percorso.' },
 { question: 'Quanto tempo richiede trovare la persona giusta?', answer: 'Dipende dal ruolo, dal mercato, dalle condizioni offerte e dalle fasi di valutazione. Condividiamo le tempistiche desiderate e i passaggi necessari prima dell’avvio; questa pagina non promette una data di assunzione.' },
 { question: 'Che cosa valutate oltre al curriculum?', answer: 'La metodologia Performia considera risultati prodotti, personalità, motivazione e conoscenze. Gli strumenti pertinenti al ruolo si inseriscono nel percorso di valutazione concordato; il curriculum è uno degli elementi del confronto.' },
 { question: 'Un test decide automaticamente chi assumere?', answer: 'No. Gli strumenti aiutano ad approfondire la valutazione. Risultati, colloqui e informazioni sul ruolo vanno letti insieme; la decisione di assunzione resta dell’azienda.' },
 { question: 'Che cosa succede dopo la scelta del candidato?', answer: 'L’inserimento richiede aspettative comprensibili, responsabilità definite, affiancamento e momenti di verifica. Il supporto a queste attività viene chiarito nel perimetro del lavoro concordato.' },
 { question: 'Come capisco se devo assumere o organizzare meglio il team?', answer: 'Si confrontano contributo richiesto, carichi di lavoro, competenze disponibili e responsabilità attuali. Questo aiuta a distinguere una necessità di persone da un problema di organizzazione.' },
];
