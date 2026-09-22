import type { PublicFaq } from '@/content/public-faq';

export function FaqSection({ items, variant = 'light' }: { items: readonly PublicFaq[]; variant?: 'light' | 'dark' }) {
 return <section className={`faq-section faq-section-${variant}`} aria-labelledby="domande-frequenti">
  <header><p className="section-kicker">Domande frequenti</p><h2 id="domande-frequenti">Risposte per orientare il prossimo passo.</h2></header>
  <div className="faq-list">{items.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
 </section>;
}
