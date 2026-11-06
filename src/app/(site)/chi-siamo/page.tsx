import type { Metadata } from 'next';
import { VisionPage } from '@/components/vision-page';
import { visionPages } from '@/content/vision';
import { pageMetadata } from '@/content/seo';

export const metadata: Metadata = pageMetadata({ path: '/chi-siamo', title: 'Chi siamo | Horyzon Consulting', description: visionPages.horyzon.intro });

export default function AboutPage() {
 return <VisionPage route="horyzon" />;
}
