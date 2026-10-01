import { SiteStructuredData } from '@/components/structured-data';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_URL, pageMetadata } from '@/content/seo';
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./inside.css";
import "./journey.css";
import "./editorial.css";
import "./narrative.css";
import "./ai-score.css";
import "./brand-logo.css";
import "./faq.css";
import "./atlas.css";
import "./hyc-splash.css";
import "./home-motion.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#07171d" };
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
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it" data-scroll-behavior="smooth" suppressHydrationWarning className={`${manrope.variable} ${mono.variable}`}>
    <body>
      <Script id="iubenda-cs-config" strategy="beforeInteractive">{`var _iub = _iub || []; _iub.csConfiguration = {"siteId":4702460,"cookiePolicyId":64704330,"lang":"it"};`}</Script>
      <Script id="iubenda-autoblocking" src="https://cs.iubenda.com/autoblocking/4702460.js" strategy="beforeInteractive" />
      <Script id="iubenda-cs" src="https://cdn.iubenda.com/cs/iubenda_cs.js" strategy="beforeInteractive" charSet="UTF-8" />
      <Script id="iubenda-policy-widget" src="https://cdn.iubenda.com/iubenda.js" strategy="afterInteractive" />
      <SiteStructuredData />
      {children}
    </body>
  </html>;
}
