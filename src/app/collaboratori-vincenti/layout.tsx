import type { Metadata } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import './deck.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-deck-serif',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-deck-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Collaboratori Vincenti · Masterclass Executive',
  description:
    "Dall'esecutore reattivo al collaboratore pan-determinato. Il metodo Horyzon per trasformare il capitale umano nel vero moltiplicatore economico dell'impresa.",
  alternates: {
    canonical: 'https://horyzon.it/collaboratori-vincenti',
  },
  openGraph: {
    title: 'Collaboratori Vincenti · Masterclass Executive — Horyzon Consulting',
    description:
      "Dall'esecutore reattivo al collaboratore pan-determinato. Il metodo Horyzon per trasformare il capitale umano nel vero moltiplicatore economico dell'impresa.",
    url: 'https://horyzon.it/collaboratori-vincenti',
    siteName: 'Horyzon Consulting',
    locale: 'it_IT',
    type: 'website',
  },
};

export default function CollaboratoriVincentiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`deck-page-wrapper ${playfair.variable} ${plusJakarta.variable}`}>
      {children}
    </div>
  );
}
