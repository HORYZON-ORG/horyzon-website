import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
 return { name: 'Horyzon Consulting', short_name: 'Horyzon', description: 'Organizzazione, patrimonio e digitale nella stessa direzione.', start_url: '/', display: 'browser', background_color: '#081521', theme_color: '#081521', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] };
}
