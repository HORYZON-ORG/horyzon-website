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
export const metadata: Metadata = { metadataBase: new URL("https://horyzon.it"), title: { default: "Horyzon Consulting — Il benessere della tua impresa", template: "%s — Horyzon" }, description: "Organizzazione, patrimonio e digitale nella stessa direzione. Horyzon accompagna le imprese dall’ascolto al cambiamento concreto.", openGraph: { title: "Horyzon Consulting", description: "L'impresa che evolve.", images: ["/opengraph-image"], locale: "it_IT", type: "website" }, icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="it" data-scroll-behavior="smooth" className={`${manrope.variable} ${cormorant.variable}`}><body>{children}</body></html>; }
