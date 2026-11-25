import Image from 'next/image';
import { FRANK_RECRUITING_VIDEO_POSTER_URL, FRANK_RECRUITING_VIDEO_URL } from '@/content/architect-recruiting-video';
import { pageMetadata } from '@/content/seo';
import { PatrimonialThemeFrame } from '@/components/patrimonial-architect-preview-theme-frame';
import header from '@/components/patrimonial-architect-header.module.css';
import styles from '@/components/patrimonial-architect-startup.module.css';

const presentationPath = '/candidature/architetti-patrimoniali/indeed';
const startupPath = '/candidature/architetti-patrimoniali/startup?canale=indeed';

export const metadata = {
  ...pageMetadata({
    path: presentationPath,
    title: 'Presentazione HORYZON per chi si è candidato su Indeed',
    description: 'Scopri il progetto Architetti Patrimoniali dopo aver inviato la candidatura su Indeed.',
  }),
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};

export default function IndeedArchitectPresentationPage() {
  return <PatrimonialThemeFrame defaultTheme="light" showBar={false} rememberChoice={false}>
    <div className={styles.page}>
      <header className={header.band}>
        <div className={header.inner}>
          <a className={header.brand} href="#presentazione" aria-label="Horyzon Consulting · Architetti Patrimoniali">
            <span className={header.logoWrap}><Image className={header.logo} src="/horyzon-logo-canonical.png" width={1670} height={390} sizes="190px" alt="Horyzon Consulting" /></span>
            <span className={header.rule} aria-hidden="true" />
            <span className={header.division}>ARCHITETTI PATRIMONIALI</span>
          </a>
        </div>
      </header>
      <main>
        <section className={styles.intro} aria-labelledby="indeed-architect-title">
          <div className={styles.introInner}>
            <span className={styles.introKicker}><span aria-hidden="true" className={styles.kickerDot} /> DOPO LA CANDIDATURA SU INDEED · BARI</span>
            <h1 id="indeed-architect-title">Conosci il progetto <em>HORYZON</em></h1>
          </div>
        </section>
        <section className={styles.presentation} id="presentazione" aria-label="Presentazione Horyzon">
          <div className={styles.videoWrap}>
            <div className={styles.videoHeader}>
              <span className={styles.videoLed} aria-hidden="true" />
              <span>IL VIDEO BREVE DI FRANK CANNOLETTA</span>
            </div>
            <div className={styles.videoStage}>
              <video className={styles.video} src={FRANK_RECRUITING_VIDEO_URL}
                poster={FRANK_RECRUITING_VIDEO_POSTER_URL} controls playsInline preload="none"
                aria-label="Frank Cannoletta presenta il progetto Architetti Patrimoniali" />
            </div>
          </div>
          <div className={styles.confirmPanel}>
            <div className={styles.confirmIntro}>
              <span className={styles.eyebrow}>IL PROSSIMO PASSO</span>
              <h2>Guarda la Startup in autonomia</h2>
              <p>La tua candidatura e il tuo CV restano su Indeed. Non serve presentare una seconda candidatura né caricare altri documenti.</p>
            </div>
            <div className={styles.confirmAction}>
              <a className={`${styles.confirmButton} ${styles.indeedLink}`} href={startupPath}>
                <span className={styles.confirmButtonText}>Guarda il video della Startup</span>
                <span className={styles.confirmArrow} aria-hidden="true">↗</span>
              </a>
              <p className={styles.confirmHint}>Dura circa 11 minuti. Al termine potrai confermare la visione e chiedere il ricontatto direttamente sul sito.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  </PatrimonialThemeFrame>;
}
