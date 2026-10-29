import localFont from 'next/font/local';

/** Display serif of the Radar Patrimoniale: it echoes the HYC monogram of the brand. */
export const radarSerif = localFont({
  variable: '--pr-serif',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  src: [
    { path: './fonts/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-600-italic.woff2', weight: '600', style: 'italic' },
  ],
});
