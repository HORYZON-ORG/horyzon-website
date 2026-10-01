import type { PublicFaq } from '@/content/public-faq';

// The FAQ block of the kit (.rd-faq in horyzon-kit.css): title on the left, answers on the right.
// Light pages sit it on cream, the home journey on ink.
export function FaqSection({ items, variant = 'light' }: { items: readonly PublicFaq[]; variant?: 'light' | 'dark' }) {
 return <section className={`rd-faq faq-section faq-section-${variant} ${variant === 'dark' ? 'rd-tone-ink' : 'rd-tone-cream'}`} aria-labelledby="domande-frequenti">
  <header><p className="rd-label">Domande frequenti</p><h2 id="domande-frequenti">Risposte per orientare il prossimo passo.</h2></header>
  <div className="faq-list">{items.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
 </section>;
}
