import { unzipSync } from 'fflate';
import { extractRawText } from 'mammoth';
import { ANNUNCI10X_MAX_AD_CHARS, ANNUNCI10X_MIN_AD_CHARS, Annunci10xPublicError } from './product-flow.ts';

export const CHECKUP_MAX_FILE_BYTES = 3_000_000;
export async function extractCheckupFile(file: File): Promise<string> {
  if (!file.size || file.size > CHECKUP_MAX_FILE_BYTES) throw invalid('Il file deve essere inferiore a 3 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  let text: string;
  try {
    if (ext === 'txt') {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (text.includes('\0')) throw new Error('binary');
    } else if (ext === 'docx' && bytes[0] === 0x50 && bytes[1] === 0x4b) {
      // Read only bounded text parts; omit media, relationships and external resources.
      let total = 0;
      const parts = unzipSync(bytes, { filter: entry => {
        if (entry.originalSize > 5_000_000 || (total += entry.originalSize) > 10_000_000) throw new Error('archive too large');
        return entry.name === 'word/document.xml' || entry.name === '[Content_Types].xml';
      } });
      if (!parts['word/document.xml']) throw new Error('not docx');
      const { zipSync } = await import('fflate');
      text = (await extractRawText({ buffer: Buffer.from(zipSync(parts)) })).value;
    } else if (ext === 'pdf' && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true });
      const pdf = await task.promise;
      try {
        if (pdf.numPages > 20) throw invalid('Il PDF può contenere al massimo 20 pagine.');
        const pages: string[] = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const content = await (await pdf.getPage(n)).getTextContent();
          pages.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join(''));
          if (pages.join('\n').length > ANNUNCI10X_MAX_AD_CHARS) throw invalid('Il testo supera 12.000 caratteri: carica un solo annuncio.');
        }
        text = pages.join('\n');
      } finally { await task.destroy(); }
    } else throw invalid('Carica un file PDF, DOCX o TXT valido.');
  } catch (error) {
    if (error instanceof Annunci10xPublicError) throw error;
    throw invalid('File non leggibile o protetto. Prova un altro file oppure incolla il testo.');
  }
  text = text.trim();
  if (text.length < ANNUNCI10X_MIN_AD_CHARS) throw invalid('Non troviamo testo sufficiente. Se il PDF è una scansione, incolla il testo: il riconoscimento delle immagini non è attivo.');
  if (text.length > ANNUNCI10X_MAX_AD_CHARS) throw invalid('Il testo supera 12.000 caratteri: carica un solo annuncio.');
  return text;
}
function invalid(message: string) { return new Annunci10xPublicError('INVALID_INPUT', message, 400); }
