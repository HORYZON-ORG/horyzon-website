import { PageStructuredData } from '@/components/structured-data';
import { HOME_DESCRIPTION, HOME_TITLE, pageMetadata } from '@/content/seo';
import type { Metadata } from "next";
import { Experience } from "@/components/experience";
export const metadata: Metadata = { ...pageMetadata({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION }), alternates: { canonical: "https://horyzon.it", types: { "text/markdown": "https://horyzon.it/index.md" } } };
export default function Home() { return <><PageStructuredData path="/" name={HOME_TITLE} description={HOME_DESCRIPTION} /><Experience /></>; }
