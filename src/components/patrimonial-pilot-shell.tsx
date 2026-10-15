'use client';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { architectPath, patrimonialEvent } from '@/content/patrimonial-funnels';
import styles from '@/app/(patrimonial-pilot)/funnel.module.css';

export function PatrimonialPilotShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === architectPath.path || pathname === patrimonialEvent.path) return <><a className="skip-link" href="#content">Vai al contenuto</a><main id="content">{children}</main></>;
  return <div className={`rd ${styles.shell}`}>
    <a className="skip-link" href="#content">Vai al contenuto</a>
    <header className={styles.header}>
      <span className={styles.brand}><span className="wordmark-logo-wrap"><Image className="wordmark-logo" src="/horyzon-logo-canonical.png" alt="Horyzon Consulting" width={1670} height={390} sizes="(max-width:600px) 138px, 178px" priority /></span></span>
      <span className={styles.division}>Benessere Patrimoniale</span>
    </header>
    <main id="content">{children}</main>
    <footer className={styles.footer}>
      <div><strong>Horyzon Benessere Patrimoniale</strong><p>FELICITÀ srl · Viale Papiniano 28, 20123 Milano<br />P. IVA 05120660757 · SDI SU9YNJA</p></div>
      <nav aria-label="Informazioni legali e contatti">
        <a href="https://www.iubenda.com/privacy-policy/64704330" className="iubenda-nostyle no-brand iubenda-embed" data-iub-z-index="10002">Privacy</a>
        <a href="https://www.iubenda.com/privacy-policy/64704330/cookie-policy" className="iubenda-nostyle no-brand iubenda-embed" data-iub-z-index="10002">Cookie</a>
        <button type="button" className="iubenda-cs-preferences-link">Preferenze cookie</button>
        <a href="mailto:info@horyzon.it">info@horyzon.it</a>
      </nav>
    </footer>
  </div>;
}
