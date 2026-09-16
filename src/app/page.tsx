import type { Metadata } from "next";
import { Experience } from "@/components/experience";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default function Home() { return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "Horyzon Consulting", legalName: "FELICITÀ srl", url: "https://horyzon.it", email: "info@horyzon.it", taxID: "05120660757" }) }} /><Experience /></>; }
