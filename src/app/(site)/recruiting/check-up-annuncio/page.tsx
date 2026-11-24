import CheckupPage from '../../annunci-10x/page';
import { RecruitingMetaPixel } from '@/components/recruiting-meta-pixel';
export { metadata } from '../../annunci-10x/page';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default function RecruitingCheckupPage() {
  return <><RecruitingMetaPixel pixelId={process.env.RECRUITING_META_PIXEL_ID ?? ''} /><CheckupPage /></>;
}
