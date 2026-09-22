import { SiteStructuredData } from '@/components/structured-data';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_URL, pageMetadata } from '@/content/seo';
import type { Metadata, Viewport } from "next";
import { Manrope, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import "./inside.css";
import "./journey.css";
import "./editorial.css";
import "./narrative.css";
import "./ai-score.css";
import "./faq.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "500", "600"] });
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#08141c" };
export const metadata: Metadata = {
  ...pageMetadata({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION }),
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: "%s — Horyzon" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="it" data-scroll-behavior="smooth" className={`${manrope.variable} ${cormorant.variable}`}><body><SiteStructuredData />{children}</body></html>; }
