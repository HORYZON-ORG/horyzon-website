-- Radar report: advice texts editable from hub.horyzon.it, and the one-time report email.
-- Additive. Seeded with the defaults of src/lib/radar/advice.ts (scripts/build-radar-advice-seed.mjs).

create table if not exists hub.radar_advice (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('question', 'area', 'autonomy', 'ai', 'economics', 'global')),
  subject text not null,
  band text not null check (band in ('critico', 'da_consolidare', 'solido')),
  position integer not null default 0,
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  action text not null check (length(trim(action)) > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (kind, subject, band)
);

create or replace function hub.radar_advice_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists radar_advice_touch on hub.radar_advice;
create trigger radar_advice_touch before update on hub.radar_advice for each row execute function hub.radar_advice_touch();

alter table hub.radar_advice enable row level security;
drop policy if exists "Radar advice superadmin full access" on hub.radar_advice;
create policy "Radar advice superadmin full access" on hub.radar_advice
  for all to authenticated
  using (hub.is_superadmin())
  with check (hub.is_superadmin());
grant select, update on hub.radar_advice to authenticated;
grant select on hub.radar_advice to service_role;

alter table hub.radar_assessments add column if not exists report_emailed_at timestamptz;

insert into hub.radar_advice (kind, subject, band, position, title, body, action) values
  ('question', 'amministrazione#0', 'critico', 0, 'Cassa senza previsione', 'Oggi scopri i problemi di liquidità quando arrivano. Senza una previsione dei prossimi mesi ogni decisione di spesa è una scommessa.', 'Costruisci un prospetto di cassa settimanale per i prossimi 3 mesi, con incassi attesi e pagamenti certi, e aggiornalo ogni lunedì. Anche un foglio di calcolo basta.'),
  ('question', 'amministrazione#0', 'da_consolidare', 1, 'Previsione di cassa da rendere regolare', 'Hai un’idea dei prossimi mesi, ma non è ancora uno strumento che si aggiorna con regolarità.', 'Fissa un appuntamento settimanale di 30 minuti per aggiornare la previsione e confrontarla con la settimana prima.'),
  ('question', 'amministrazione#0', 'solido', 2, 'Cassa sotto controllo', 'Sapere cosa entra ed esce nei prossimi mesi ti permette di decidere con calma. È una base su cui costruire.', 'Affida l’aggiornamento della previsione a un collaboratore o al commercialista: tu la leggi e decidi.'),
  ('question', 'amministrazione#1', 'critico', 3, 'Nessun piano scritto', 'Senza un piano non c’è un metro per capire se l’anno sta andando bene o male: si giudica a sensazione.', 'Scrivi un budget annuale semplice: ricavi attesi per mese, costi fissi, costi variabili. Una pagina basta per iniziare.'),
  ('question', 'amministrazione#1', 'da_consolidare', 4, 'Piano presente, confronto irregolare', 'Il piano esiste, ma viene guardato poco: così non guida le scelte.', 'Confronta ogni mese budget e risultati reali e annota le tre differenze più grandi con la loro causa.'),
  ('question', 'amministrazione#1', 'solido', 5, 'Piano e risultati dialogano', 'Confrontare piano e risultati è ciò che distingue un’impresa guidata da una che reagisce.', 'Usa il confronto mensile anche con i responsabili di reparto, ognuno sulle proprie voci.'),
  ('question', 'amministrazione#2', 'critico', 6, 'Margini non conosciuti', 'Se non sai quanto guadagni su ogni servizio o prodotto, rischi di spingere proprio quelli che rendono meno.', 'Calcola il margine dei tuoi tre servizi o prodotti principali: prezzo meno costi diretti (materiali, ore, fornitori).'),
  ('question', 'amministrazione#2', 'da_consolidare', 7, 'Margini stimati, non misurati', 'Hai un’idea dei margini, ma non su tutto il listino o non aggiornata.', 'Estendi il calcolo del margine a tutto il listino e rivedilo ogni trimestre o quando cambiano i costi.'),
  ('question', 'amministrazione#2', 'solido', 8, 'Margini chiari', 'Conoscere i margini ti permette di scegliere cosa vendere e a chi. È un vantaggio competitivo.', 'Condividi i margini con chi vende, così le trattative proteggono il risultato e non solo il fatturato.'),
  ('question', 'amministrazione#3', 'critico', 9, 'Spese decise d’istinto', 'Le spese importanti passano dalla tua testa, non da una regola: è difficile delegarle e controllarle.', 'Fissa una soglia di spesa oltre la quale serve un confronto con il budget, e scrivila.'),
  ('question', 'amministrazione#3', 'da_consolidare', 10, 'Controllo di spesa a metà', 'A volte il budget viene consultato, a volte no: la regola non è ancora un’abitudine.', 'Crea una breve lista di controllo per le spese sopra soglia e usala per tre mesi.'),
  ('question', 'amministrazione#3', 'solido', 11, 'Spesa governata', 'Le decisioni di spesa seguono una regola: puoi delegarle senza perdere il controllo.', 'Delega le spese sotto soglia ai responsabili e rivedi solo il riepilogo mensile.'),
  ('question', 'amministrazione#4', 'critico', 12, 'L’amministrazione si ferma senza di te', 'Se pagamenti e incassi dipendono da te, un mese di assenza diventa un rischio per fornitori e clienti.', 'Scrivi la procedura di pagamenti e incassi e affidane l’esecuzione a una persona, con deleghe bancarie e limiti chiari.'),
  ('question', 'amministrazione#4', 'da_consolidare', 13, 'Autonomia amministrativa parziale', 'Alcune attività vanno avanti da sole, altre aspettano ancora la tua firma o il tuo controllo.', 'Individua le due operazioni amministrative per cui ti cercano più spesso e delegale con un limite di importo.'),
  ('question', 'amministrazione#4', 'solido', 14, 'Amministrazione autonoma', 'Pagamenti e incassi funzionano anche senza di te: è libertà vera per il titolare.', 'Mantieni un controllo mensile a campione e un riepilogo di cassa: fiducia, con verifica.'),
  ('question', 'produzione#0', 'critico', 15, 'Il servizio vive nella testa delle persone', 'Senza procedure scritte la qualità dipende da chi lavora quel giorno, e ogni nuovo ingresso costa settimane.', 'Scegli il processo che svolgete più spesso e scrivilo in una pagina: passaggi, responsabile, controllo finale.'),
  ('question', 'produzione#0', 'da_consolidare', 16, 'Procedure incomplete', 'Alcune attività sono scritte, altre no, oppure le procedure esistono ma non vengono aggiornate.', 'Fai rileggere le procedure a chi le usa ogni giorno e aggiornatele insieme, una al mese.'),
  ('question', 'produzione#0', 'solido', 17, 'Metodo scritto e condiviso', 'Le procedure rendono il servizio ripetibile: sono la base per crescere e delegare.', 'Trasforma le procedure in una breve guida di inserimento per i nuovi collaboratori.'),
  ('question', 'produzione#1', 'critico', 18, 'Soddisfazione a sensazione', 'Senza una misura scopri i clienti scontenti quando se ne vanno.', 'A fine lavoro chiedi a ogni cliente due cose: un voto da 1 a 10 e cosa miglioreresti. Raccogli le risposte in un foglio.'),
  ('question', 'produzione#1', 'da_consolidare', 19, 'Misura saltuaria', 'Chiedi un parere ogni tanto, ma i dati non diventano decisioni.', 'Rendi la domanda automatica a fine servizio e guarda i risultati una volta al mese con il team.'),
  ('question', 'produzione#1', 'solido', 20, 'Clienti ascoltati', 'Misurare la soddisfazione ti dà un segnale precoce e argomenti di vendita veri.', 'Chiedi ai clienti più soddisfatti una recensione o una referenza, con il loro consenso.'),
  ('question', 'produzione#2', 'critico', 21, 'Ogni nuovo ingresso passa da te', 'Se un nuovo collaboratore deve chiedere tutto a te, ogni assunzione ti toglie tempo invece di dartene.', 'Prepara un percorso di inserimento di due settimane: cosa leggere, chi affiancare, cosa saper fare alla fine.'),
  ('question', 'produzione#2', 'da_consolidare', 22, 'Inserimento lento', 'I nuovi imparano, ma per affiancamento e tentativi, e tu resti il riferimento.', 'Nomina per ogni nuovo ingresso un tutor che non sia tu e verifica dopo 30 giorni cosa manca.'),
  ('question', 'produzione#2', 'solido', 23, 'Inserimenti autonomi', 'Un nuovo collaboratore diventa operativo senza pesare su di te: puoi crescere.', 'Raccogli le domande più frequenti dei nuovi e aggiungile alla guida di inserimento.'),
  ('question', 'produzione#3', 'critico', 24, 'Errori gestiti caso per caso', 'Ogni reclamo diventa un’emergenza da risolvere a mano, spesso da te, e l’errore si ripete.', 'Definisci chi riceve i reclami, entro quanto si risponde e dove si annota la causa, anche solo su un foglio condiviso.'),
  ('question', 'produzione#3', 'da_consolidare', 25, 'Gestione errori da consolidare', 'Un modo di fare esiste, ma non sempre viene seguito e le cause non vengono analizzate.', 'Una volta al mese rivedi i reclami con il team e scegli un’azione per eliminare la causa più frequente.'),
  ('question', 'produzione#3', 'solido', 26, 'Errori che insegnano', 'Un protocollo per reclami ed errori protegge i clienti e migliora il servizio nel tempo.', 'Condividi con il team i miglioramenti nati dai reclami: rafforza la cultura della qualità.'),
  ('question', 'produzione#4', 'critico', 27, 'La qualità dipende da te', 'Se la qualità cala quando non ci sei, il tuo tempo è il limite alla crescita dell’impresa.', 'Definisci tre controlli di qualità che altri possano fare al posto tuo e scegli chi li fa.'),
  ('question', 'produzione#4', 'da_consolidare', 28, 'Qualità in parte delegata', 'Su alcuni lavori la qualità regge, su quelli importanti serve ancora il tuo occhio.', 'Scegli un tipo di lavoro importante e affidalo interamente a un collaboratore, con una verifica finale concordata.'),
  ('question', 'produzione#4', 'solido', 29, 'Qualità indipendente dal titolare', 'Il servizio mantiene il livello anche senza di te: questo aumenta il valore dell’impresa.', 'Mantieni un controllo a campione e dedica il tempo liberato allo sviluppo.'),
  ('question', 'commerciale#0', 'critico', 30, 'Clienti che entrano ed escono senza numeri', 'Senza sapere quanti clienti arrivano e quanti perdi, non sai se l’impresa sta crescendo davvero.', 'Tieni un conteggio mensile di tre numeri: nuovi clienti, clienti persi, clienti attivi.'),
  ('question', 'commerciale#0', 'da_consolidare', 31, 'Numeri commerciali parziali', 'Conosci alcuni dati, ma non in modo regolare o non per tutti i canali.', 'Aggiorna ogni mese i tre numeri e annota il motivo principale dei clienti persi.'),
  ('question', 'commerciale#0', 'solido', 32, 'Portafoglio clienti misurato', 'Sai come si muove il tuo portafoglio clienti: puoi reagire prima che diventi un problema.', 'Aggiungi il valore medio per cliente, per capire quali clienti conviene cercare.'),
  ('question', 'commerciale#1', 'critico', 33, 'Si vende a modo proprio', 'Senza un processo le vendite dipendono dal talento di chi vende, spesso il tuo.', 'Scrivi le fasi della tua vendita (primo contatto, incontro, proposta, chiusura) e cosa deve succedere in ognuna.'),
  ('question', 'commerciale#1', 'da_consolidare', 34, 'Processo di vendita seguito a metà', 'Il processo esiste, ma ognuno lo adatta e senza di te si perde.', 'Usa un elenco trattative condiviso, anche un foglio, con la fase di ognuna, e rivedilo ogni settimana.'),
  ('question', 'commerciale#1', 'solido', 35, 'Vendita strutturata', 'Un processo seguito da tutti rende le vendite prevedibili e insegnabili.', 'Misura quante trattative passano da una fase all’altra, per capire dove se ne perdono di più.'),
  ('question', 'commerciale#2', 'critico', 36, 'Ogni mese si riparte da zero', 'Se le entrate sono quasi tutte occasionali, ogni mese devi rincorrere nuove vendite.', 'Individua un servizio che i clienti usano di continuo e proponilo come abbonamento o contratto annuale.'),
  ('question', 'commerciale#2', 'da_consolidare', 37, 'Ricorrenza da far crescere', 'Una parte delle entrate si ripete, ma non basta ancora a dare stabilità.', 'Proponi rinnovo o abbonamento a tutti i clienti attuali prima di cercarne di nuovi.'),
  ('question', 'commerciale#2', 'solido', 38, 'Entrate stabili', 'Le entrate ricorrenti rendono l’impresa più stabile e più facile da pianificare.', 'Proteggi i rinnovi con un contatto periodico e misura quanti clienti non rinnovano.'),
  ('question', 'commerciale#3', 'critico', 39, 'Chi vende impara da solo', 'Senza formazione chi vende ripete i propri errori, e il risultato resta legato a te.', 'Organizza una sessione al mese sulle obiezioni più frequenti, con simulazioni di trattativa.'),
  ('question', 'commerciale#3', 'da_consolidare', 40, 'Formazione occasionale', 'Qualche formazione c’è stata, ma non è un percorso.', 'Definisci un piccolo percorso: tre temi in tre mesi, con un obiettivo misurabile per ognuno.'),
  ('question', 'commerciale#3', 'solido', 41, 'Team di vendita preparato', 'Chi vende ha metodo e strumenti: le vendite non dipendono solo da te.', 'Fai condividere al venditore migliore le sue pratiche con il resto del team.'),
  ('question', 'commerciale#4', 'critico', 42, 'Le trattative importanti aspettano te', 'Se le vendite importanti si chiudono solo con te, il tuo tempo decide il fatturato.', 'Scegli una trattativa di media importanza e falla condurre a un collaboratore dall’inizio alla fine, con te solo come supporto.'),
  ('question', 'commerciale#4', 'da_consolidare', 43, 'Delega commerciale parziale', 'Alcune trattative si chiudono senza di te, le più grandi no.', 'Definisci sconti e condizioni che chi vende può concedere senza chiederti.'),
  ('question', 'commerciale#4', 'solido', 44, 'Vendite indipendenti dal titolare', 'Le trattative si chiudono anche senza di te: il fatturato non dipende dalla tua agenda.', 'Dedica il tuo tempo ai clienti strategici e alle relazioni che solo tu puoi aprire.'),
  ('question', 'marketing#0', 'critico', 45, 'Cliente ideale non definito', 'Se non è chiaro a chi ti rivolgi e perché scegliere te, ogni messaggio vale poco.', 'Descrivi in una pagina il tuo cliente migliore di oggi: settore, dimensione, problema, perché ti ha scelto.'),
  ('question', 'marketing#0', 'da_consolidare', 46, 'Posizionamento da affinare', 'Hai un’idea del tuo cliente, ma il messaggio non è ancora netto.', 'Scrivi in una frase cosa fai, per chi e cosa ti distingue, e verificala con tre clienti.'),
  ('question', 'marketing#0', 'solido', 47, 'Posizionamento chiaro', 'Sapere per chi lavori e cosa ti distingue rende più efficace ogni euro di marketing.', 'Usa la tua differenza in modo coerente su sito, social e proposte commerciali.'),
  ('question', 'marketing#1', 'critico', 48, 'Contatti solo dal passaparola', 'Il passaparola è prezioso ma imprevedibile: non puoi pianificare la crescita.', 'Scegli un canale da presidiare con costanza (contenuti, campagne o collaborazioni) e conta i contatti che porta ogni mese.'),
  ('question', 'marketing#1', 'da_consolidare', 49, 'Flusso di contatti irregolare', 'Qualche canale funziona, ma a periodi.', 'Scegli il canale che rende di più e dagli un calendario fisso per tre mesi.'),
  ('question', 'marketing#1', 'solido', 50, 'Flusso di contatti costante', 'Un flusso regolare di richieste rende la crescita pianificabile.', 'Misura quanto ti costa ogni contatto per canale e sposta il budget su quelli che rendono.'),
  ('question', 'marketing#2', 'critico', 51, 'Reputazione online trascurata', 'I clienti ti cercano online prima di contattarti: se trovano poco, perdi fiducia.', 'Chiedi una recensione ai dieci clienti più soddisfatti e aggiorna la scheda Google dell’azienda.'),
  ('question', 'marketing#2', 'da_consolidare', 52, 'Reputazione curata a tratti', 'Recensioni e profili ci sono, ma non vengono seguiti con regolarità.', 'Rispondi a tutte le recensioni entro una settimana e pubblica almeno un contenuto al mese.'),
  ('question', 'marketing#2', 'solido', 53, 'Reputazione solida', 'Una buona reputazione online accorcia le trattative e toglie peso al prezzo.', 'Porta le recensioni migliori dentro sito e proposte commerciali, dove il cliente decide.'),
  ('question', 'marketing#3', 'critico', 54, 'Visibilità senza vendite', 'Il marketing fa rumore ma non porta contatti pronti per chi vende.', 'Definisci con chi vende cosa rende buono un contatto e filtra le richieste con due o tre domande prima di passarle.'),
  ('question', 'marketing#3', 'da_consolidare', 55, 'Marketing e vendite poco allineati', 'Alcuni contatti arrivano pronti, molti no.', 'Fate un incontro mensile tra marketing e vendite per vedere quali contatti sono diventati clienti e da dove venivano.'),
  ('question', 'marketing#3', 'solido', 56, 'Marketing che alimenta le vendite', 'I contatti arrivano già interessati: chi vende lavora meglio e più in fretta.', 'Misura, per ogni canale, quanti contatti diventano clienti.'),
  ('question', 'marketing#4', 'critico', 57, 'Il marketing si ferma senza di te', 'Se sei tu a scrivere, pubblicare e decidere tutto, il marketing esiste solo quando hai tempo.', 'Affida a una persona o a un fornitore un calendario di pubblicazioni di tre mesi, con te solo in approvazione.'),
  ('question', 'marketing#4', 'da_consolidare', 58, 'Marketing in parte delegato', 'Qualcuno esegue, ma idee e decisioni passano ancora da te.', 'Scrivi linee guida semplici (tono, temi, cosa non dire), così chi esegue può decidere da solo.'),
  ('question', 'marketing#4', 'solido', 59, 'Marketing autonomo', 'Il marketing va avanti anche senza di te: la visibilità non dipende dalla tua agenda.', 'Rivedi i risultati una volta al mese, non i singoli contenuti.'),
  ('question', 'risorse-umane#0', 'critico', 60, 'Si assume d’urgenza', 'Senza un processo di selezione si assume chi c’è quando serve, e gli errori costano cari.', 'Per il prossimo ruolo scrivi prima una descrizione chiara (compiti, risultati attesi, competenze) e fai le stesse domande a tutti i candidati.'),
  ('question', 'risorse-umane#0', 'da_consolidare', 61, 'Selezione da rendere metodo', 'Qualche passaggio c’è, ma cambia ogni volta.', 'Prepara un modello di annuncio e una scheda di valutazione uguale per tutti i colloqui.'),
  ('question', 'risorse-umane#0', 'solido', 62, 'Selezione strutturata', 'Un processo di selezione chiaro riduce gli errori e attira persone migliori.', 'Misura quante persone assunte sono ancora in azienda dopo un anno.'),
  ('question', 'risorse-umane#1', 'critico', 63, 'Ruoli confusi', 'Se le persone non sanno chi decide cosa, tutto torna da te.', 'Disegna l’organigramma attuale e scrivi, per ogni ruolo, tre responsabilità e a chi risponde.'),
  ('question', 'risorse-umane#1', 'da_consolidare', 64, 'Ruoli in parte chiari', 'I ruoli esistono, ma i confini tra l’uno e l’altro sono sfumati.', 'Chiarisci con ogni persona quali decisioni può prendere da sola e quali deve condividere.'),
  ('question', 'risorse-umane#1', 'solido', 65, 'Responsabilità chiare', 'Ognuno sa cosa fare e a chi rispondere: le decisioni non si accumulano sul titolare.', 'Rivedi l’organigramma una volta l’anno o quando l’impresa cresce.'),
  ('question', 'risorse-umane#2', 'critico', 66, 'Nessun momento di squadra', 'Senza momenti condivisi le persone lavorano accanto, ma non insieme.', 'Fissa una riunione di 30 minuti ogni due settimane per condividere risultati e problemi.'),
  ('question', 'risorse-umane#2', 'da_consolidare', 67, 'Squadra curata a volte', 'Qualche momento insieme c’è, ma non è regolare.', 'Metti in calendario per tutto l’anno gli incontri di squadra, così non dipendono dalle urgenze.'),
  ('question', 'risorse-umane#2', 'solido', 68, 'Squadra unita', 'Curare il clima rende le persone più coinvolte e meno dipendenti dalle tue istruzioni.', 'Affida a rotazione ai collaboratori l’organizzazione dei momenti di squadra.'),
  ('question', 'risorse-umane#3', 'critico', 69, 'Benessere non misurato', 'Scopri il malessere delle persone quando qualcuno se ne va.', 'Due volte l’anno fai un breve questionario anonimo sul clima, di cinque domande, e condividi i risultati.'),
  ('question', 'risorse-umane#3', 'da_consolidare', 70, 'Ascolto occasionale', 'Parli con le persone, ma senza un modo regolare di capire come stanno.', 'Introduci un colloquio individuale di 20 minuti ogni trimestre con ogni collaboratore.'),
  ('question', 'risorse-umane#3', 'solido', 71, 'Persone ascoltate', 'Misurare il benessere ti permette di intervenire prima che nascano problemi.', 'Collega i risultati dell’ascolto a una o due azioni concrete e comunicale a tutti.'),
  ('question', 'risorse-umane#4', 'critico', 72, 'Dipendenza da persone chiave', 'Se una persona chiave se ne va, l’impresa si ferma: è un rischio grande quanto la tua assenza.', 'Individua le due persone indispensabili e affianca a ognuna una seconda persona sulle attività critiche.'),
  ('question', 'risorse-umane#4', 'da_consolidare', 73, 'Sostituzioni possibili ma difficili', 'Qualcuno potrebbe subentrare, ma con fatica e perdita di informazioni.', 'Chiedi a ogni persona chiave di scrivere le proprie attività ricorrenti e dove si trovano le informazioni.'),
  ('question', 'risorse-umane#4', 'solido', 74, 'Squadra che regge le assenze', 'Nessuno è insostituibile: l’impresa è più solida e vale di più.', 'Mantieni l’affiancamento sulle attività critiche anche quando tutto va bene.'),
  ('area', 'amministrazione', 'critico', 75, 'Amministrazione da mettere in sicurezza', 'I numeri arrivano tardi o non arrivano: le decisioni si prendono a sensazione e la cassa può sorprenderti.', 'Parti da cassa a tre mesi e margini dei servizi principali: sono le due informazioni che cambiano più decisioni.'),
  ('area', 'amministrazione', 'da_consolidare', 76, 'Amministrazione in costruzione', 'Alcuni strumenti ci sono, ma non sono ancora un sistema regolare che guida le scelte.', 'Rendi fissi gli appuntamenti con i numeri: cassa ogni settimana, budget ogni mese.'),
  ('area', 'amministrazione', 'solido', 77, 'Amministrazione solida', 'I numeri guidano le decisioni: è una base su cui far crescere gli altri reparti.', 'Usa questa solidità per delegare: numeri chiari rendono sicura la delega.'),
  ('area', 'produzione', 'critico', 78, 'Servizio fragile', 'La qualità dipende da persone e giornate: è difficile crescere senza perdere clienti.', 'Parti dalla procedura del servizio più venduto e da un controllo di qualità fatto da altri.'),
  ('area', 'produzione', 'da_consolidare', 79, 'Produzione in costruzione', 'Il servizio funziona, ma poggia ancora molto su abitudini e sulla tua presenza.', 'Scrivi e aggiorna le procedure insieme a chi lavora ogni giorno.'),
  ('area', 'produzione', 'solido', 80, 'Produzione solida', 'Il servizio è ripetibile e misurato: puoi aumentare i volumi con fiducia.', 'Usa procedure e misure di soddisfazione come argomento di vendita.'),
  ('area', 'commerciale', 'critico', 81, 'Vendite che dipendono da te', 'Senza numeri e senza un processo, il fatturato segue la tua energia e la tua agenda.', 'Parti dai tre numeri mensili (nuovi, persi, attivi) e da una trattativa delegata.'),
  ('area', 'commerciale', 'da_consolidare', 82, 'Commerciale in costruzione', 'Qualche metodo c’è, ma le vendite importanti restano legate a te.', 'Definisci le condizioni che chi vende può concedere senza chiederti.'),
  ('area', 'commerciale', 'solido', 83, 'Commerciale solido', 'Le vendite hanno metodo e numeri: il fatturato è più prevedibile.', 'Lavora sulle entrate ricorrenti per rendere la crescita ancora più stabile.'),
  ('area', 'marketing', 'critico', 84, 'Marketing da impostare', 'I clienti arrivano soprattutto dal passaparola e da te: la crescita non è pianificabile.', 'Parti dal cliente ideale e da un solo canale presidiato con costanza.'),
  ('area', 'marketing', 'da_consolidare', 85, 'Marketing in costruzione', 'Qualcosa si muove, ma senza continuità e con pochi contatti pronti per chi vende.', 'Allinea marketing e vendite su cosa rende buono un contatto.'),
  ('area', 'marketing', 'solido', 86, 'Marketing solido', 'Hai un posizionamento chiaro e un flusso di contatti costante.', 'Misura quanto ti costa acquisire un cliente, per investire dove rende.'),
  ('area', 'risorse-umane', 'critico', 87, 'Organizzazione delle persone da costruire', 'Ruoli poco chiari e dipendenza da poche persone: tutto torna sulla tua scrivania.', 'Parti dall’organigramma, con tre responsabilità per ruolo, e dall’affiancamento sulle persone chiave.'),
  ('area', 'risorse-umane', 'da_consolidare', 88, 'Persone in costruzione', 'La squadra c’è, ma ruoli, ascolto e selezione non sono ancora un metodo.', 'Introduci colloqui individuali regolari e una scheda di selezione unica.'),
  ('area', 'risorse-umane', 'solido', 89, 'Persone solide', 'Ruoli chiari e squadra curata: l’impresa regge anche le assenze.', 'Investi sulla crescita delle persone chiave, per prepararle a nuove responsabilità.'),
  ('autonomy', 'titolare', 'critico', 90, 'L’impresa dipende da te', 'In quasi tutti i reparti le attività si fermano o rallentano quando non ci sei. Il tuo tempo è il limite della crescita.', 'Scegli un reparto e un’attività da delegare completamente nei prossimi 90 giorni, con procedura e responsabile.'),
  ('autonomy', 'titolare', 'da_consolidare', 91, 'Autonomia parziale', 'Alcuni reparti vanno avanti senza di te, altri no: la dipendenza è concentrata in pochi punti.', 'Concentrati sul reparto dove l’autonomia è più bassa: è lì che il tuo tempo resta bloccato.'),
  ('autonomy', 'titolare', 'solido', 92, 'Impresa autonoma', 'L’impresa funziona anche senza la tua presenza diretta: puoi dedicarti alla direzione e allo sviluppo.', 'Mantieni riunioni periodiche e numeri chiari per guidare senza tornare operativo.'),
  ('ai', 'ai', 'critico', 93, 'AI ancora lontana', 'L’intelligenza artificiale è poco usata o il team non si sente pronto. Si può partire da piccoli passi.', 'Scegli un’attività ripetitiva (email, preventivi, report) e prova per un mese uno strumento di AI con una persona del team.'),
  ('ai', 'ai', 'da_consolidare', 94, 'AI in sperimentazione', 'L’AI viene usata, ma a macchia di leopardo e senza regole comuni.', 'Raccogli gli usi che funzionano, scrivi due regole d’uso (dati e verifica) e condividile con tutti.'),
  ('ai', 'ai', 'solido', 95, 'AI nel lavoro quotidiano', 'Il team usa l’AI e si sente pronto: può diventare una leva per ridurre la dipendenza da te.', 'Collega l’AI alle procedure scritte, così aiuta a fare il lavoro senza chiedere a te.'),
  ('economics', 'utile_ora', 'critico', 96, 'Il tuo tempo rende poco', 'Ogni ora che dedichi all’impresa genera poco utile. Lavorare di più non basta: serve cambiare dove va il tuo tempo.', 'Elenca le attività a basso valore che fai ogni settimana e decidi quali delegare o eliminare.'),
  ('economics', 'utile_ora', 'da_consolidare', 97, 'Il tuo tempo rende, con margini di miglioramento', 'Il tuo tempo produce utile, ma una parte delle ore va in attività che altri potrebbero fare.', 'Sposta almeno cinque ore a settimana da attività operative a vendita, sviluppo o controllo.'),
  ('economics', 'utile_ora', 'solido', 98, 'Il tuo tempo rende bene', 'Ogni ora che dedichi all’impresa produce un utile significativo.', 'Proteggi le ore ad alto valore e delega il resto: è così che l’utile per ora continua a crescere.'),
  ('global', 'indice', 'critico', 99, 'Fondamenta da costruire', 'L’impresa funziona soprattutto grazie a te e a poche persone: organizzazione e autonomia sono ancora deboli.', 'Nei prossimi 90 giorni lavora su un solo reparto, quello prioritario: meglio un passo fatto che dieci iniziati.'),
  ('global', 'indice', 'da_consolidare', 100, 'Impresa in costruzione', 'Ci sono basi su cui lavorare: alcuni reparti sono organizzati, altri dipendono ancora da te.', 'Porta il reparto prioritario al livello di quello più solido, usando lo stesso metodo.'),
  ('global', 'indice', 'solido', 101, 'Impresa organizzata', 'Organizzazione e autonomia sono buone: l’impresa ha basi solide per crescere.', 'Punta sulla crescita: nuovi servizi, nuovi mercati o nuove persone chiave.')
on conflict (kind, subject, band) do nothing;
