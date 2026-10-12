import archive from '@/data/archive.json';
import { pages } from '@/data/pages';

export const visionRoutes = ['horyzon', 'impresa', 'economia', 'umanita'] as const;
export type VisionRoute = typeof visionRoutes[number];
type Perspective = { title: string; text: string; href?: string };
type VisionContent = {
  label: string; title: string; intro: string; body: readonly string[];
  sectionTitle: string; sectionLead?: string; perspectives: readonly Perspective[];
  perspectivesTitle: string; statement: string; sceneCaption: string;
};

export const visionPages: Record<VisionRoute, VisionContent> = {
  horyzon: {
    label: 'La nostra direzione', title: pages.horyzon.title, intro: pages.horyzon.intro,
    body: pages.horyzon.body, sectionTitle: 'Tre prospettive. Una missione comune.',
    perspectivesTitle: 'Impresa, economia e umanità.',
    perspectives: [
      { title: 'Impresa', text: archive.impresa.intro, href: '/impresa' },
      { title: 'Economia', text: archive.economia.intro, href: '/economia' },
      { title: 'Umanità', text: pages.umanita.intro, href: '/umanita' },
    ],
    statement: 'Una visione che diventa lavoro.',
    sceneCaption: 'Imprese, economia e persone nello stesso orizzonte.',
  },
  impresa: {
    label: 'L’arte dell’impresa', title: archive.impresa.title, intro: archive.impresa.intro,
    body: archive.impresa.sections[0].text.slice(0, 3),
    sectionTitle: 'Un’opera che fa crescere chi la costruisce.', sectionLead: archive.impresa.sections[0].title,
    perspectivesTitle: 'Le qualità che diventano un’opera comune.',
    perspectives: archive.impresa.points.map((title, i) => ({ title, text: archive.impresa.sections[0].text[i + 3] })),
    statement: 'Trasformare talenti individuali in un’opera condivisa.',
    sceneCaption: 'Persone e organizzazione trasformano idee in valore.',
  },
  economia: {
    label: 'Una scienza umana', title: archive.economia.title, intro: archive.economia.intro,
    body: archive.economia.sections[0].text.slice(0, 3),
    sectionTitle: 'Risorse, relazioni e conseguenze.', sectionLead: archive.economia.sections[0].title,
    perspectivesTitle: 'Una direzione che guarda oltre il presente.',
    perspectives: archive.economia.points.map((title, i) => ({ title, text: archive.economia.sections[0].text[i + 3] })),
    statement: 'Generare valore che duri nel tempo.',
    sceneCaption: 'Le risorse orientano le scelte. Le scelte costruiscono valore.',
  },
  umanita: {
    label: pages.umanita.kicker, title: pages.umanita.title, intro: pages.umanita.intro,
    body: [...pages.umanita.body, archive.umanita.sections[0].text[0]],
    sectionTitle: 'La persona dà senso a ogni scelta.',
    perspectivesTitle: 'Corpo, mente e spirito. Insieme.',
    perspectives: archive.umanita.points.map((title, i) => ({ title, text: archive.umanita.sections[0].text[i + 3] })),
    statement: 'Talento e competenza al servizio degli altri.',
    sceneCaption: 'Energia, comprensione e significato nella stessa persona.',
  },
};

export function isVisionRoute(value: string): value is VisionRoute {
  return visionRoutes.includes(value as VisionRoute);
}
