/**
 * SVG adapter
 */

import type { ConvertOptions } from '../types';

let linkedom: any = null;

async function getDOMParser() {
  if (!linkedom) {
    linkedom = await import('linkedom');
  }
  return linkedom;
}

export async function parseSVG(
  buffer: Buffer,
  _options?: ConvertOptions
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const svg = buffer.toString('utf-8');

  const { parseHTML } = await getDOMParser();
  const document = parseHTML(svg);

  const info: string[] = ['# SVG Image\n'];
  const textElements: string[] = [];

  // Get dimensions
  const svgElement = document.querySelector('svg');
  if (svgElement) {
    const width = svgElement.getAttribute('width');
    const height = svgElement.getAttribute('height');
    if (width && height) {
      info.push(`Dimensions: ${width} x ${height}`);
    }

    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      info.push(`ViewBox: ${viewBox}`);
    }

    // Extract title
    const title = svgElement.querySelector('title')?.textContent;
    if (title) {
      info.push(`Title: ${title}`);
    }

    // Extract description
    const desc = svgElement.querySelector('desc')?.textContent;
    if (desc) {
      info.push(`Description: ${desc}`);
    }
  }

  // Extract all text elements
  const texts = document.querySelectorAll('text');
  for (const text of texts) {
    const content = text.textContent?.trim();
    if (content) {
      textElements.push(content);
    }
  }

  if (textElements.length > 0) {
    info.push(`\n## Text Content\n`);
    for (const t of textElements) {
      info.push(`- ${t}`);
    }
  }

  // Add raw SVG as code block
  info.push(`\n## SVG Source\n`);
  info.push('```svg');
  // Add truncated SVG (first 2000 chars)
  const truncatedSvg = svg.length > 2000 ? svg.slice(0, 2000) + '\n... (truncated)' : svg;
  info.push(truncatedSvg);
  info.push('```');

  return { content: info.join('\n') };
}
