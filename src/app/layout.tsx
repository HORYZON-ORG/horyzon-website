import type { Metadata, Viewport } from "next";
import { Manrope, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import "./inside.css";
import "./journey.css";
import "./editorial.css";
import "./narrative.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "500", "600"] });
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#08141c" };
export const metadata: Metadata = { metadataBase: new URL("https://horyzon.it"), title: { default: "Horyzon — Diagnosi e organizzazione per l’impresa", template: "%s — Horyzon" }, description: "Dal Radar d’Impresa all’organizzazione obiettivo: cinque reparti, responsabilità ed evidenze per un’evoluzione misurabile.", openGraph: { title: "Horyzon — Leggi, organizza, misura l’impresa", description: "Diagnosi del presente, organizzazione obiettivo e progresso misurabile.", images: ["/opengraph-image"], locale: "it_IT", type: "website" }, icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="it" data-scroll-behavior="smooth" className={`${manrope.variable} ${cormorant.variable}`}><body>{children}</body></html>; }
