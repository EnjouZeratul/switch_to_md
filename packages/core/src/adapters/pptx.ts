/**
 * PPTX adapter
 */

import type { ConvertOptions } from '../types';

let AdmZip: any = null;
let xml2js: any = null;

async function getLibs() {
  if (!AdmZip) {
    AdmZip = (await import('adm-zip')).default || (await import('adm-zip'));
  }
  if (!xml2js) {
    xml2js = await import('xml2js');
  }
  return { AdmZip, xml2js };
}

export async function parsePPTX(
  buffer: Buffer,
  _options?: ConvertOptions
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const { AdmZip, xml2js } = await getLibs();

  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Find slide files
    const slideEntries = entries
      .filter((e: any) => /ppt\/slides\/slide\d+\.xml/.test(e.entryName))
      .sort((a: any, b: any) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || '0');
        const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || '0');
        return numA - numB;
      });

    const slides: string[] = [];

    for (const entry of slideEntries) {
      const xmlContent = zip.readAsText(entry);
      const slideContent = await parseSlideXML(xmlContent, xml2js);
      slides.push(slideContent);
    }

    // Build markdown
    const sections: string[] = ['# Presentation\n'];

    for (let i = 0; i < slides.length; i++) {
      sections.push(`## Slide ${i + 1}\n`);
      sections.push(slides[i]);
      sections.push('\n---\n');
    }

    return {
      content: sections.join('\n'),
      metadata: {
        slides: slides.length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse PPTX: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function parseSlideXML(xml: string, xml2js: any): Promise<string> {
  const parser = new xml2js.Parser();

  try {
    const result = await parser.parseStringPromise(xml);
    const texts: string[] = [];

    // Extract text from the parsed XML
    extractTextFromObject(result, texts);

    return texts.join('\n');
  } catch {
    return '';
  }
}

function extractTextFromObject(obj: any, texts: string[]): void {
  if (typeof obj === 'string') {
    if (obj.trim()) {
      texts.push(obj.trim());
    }
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractTextFromObject(item, texts);
    }
    return;
  }

  if (typeof obj === 'object' && obj !== null) {
    // Look for text content in common PowerPoint XML elements
    if (obj['a:t']) {
      extractTextFromObject(obj['a:t'], texts);
    }

    // Also check for 't' elements (text)
    if (obj['t']) {
      extractTextFromObject(obj['t'], texts);
    }

    // Recurse into child objects
    for (const key of Object.keys(obj)) {
      if (key !== 'a:t' && key !== 't') {
        extractTextFromObject(obj[key], texts);
      }
    }
  }
}
