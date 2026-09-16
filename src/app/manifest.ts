import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
 return { name: 'Horyzon — Il sistema impresa', short_name: 'Horyzon', description: 'Diagnosi, organizzazione e progresso misurabile per l’impresa.', start_url: '/', display: 'browser', background_color: '#081521', theme_color: '#081521', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] };
}
