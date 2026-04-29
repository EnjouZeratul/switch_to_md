/**
 * EPUB adapter
 */

import type { ConvertOptions } from '../types';

let AdmZip: any = null;

async function getZip() {
  if (!AdmZip) {
    AdmZip = (await import('adm-zip')).default || (await import('adm-zip'));
  }
  return AdmZip;
}

export async function parseEPUB(
  buffer: Buffer,
  _options?: ConvertOptions
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const AdmZip = await getZip();

  try {
    const zip = new AdmZip(buffer);

    // Read container.xml to find content.opf location
    const containerXml = zip.readAsText('META-INF/container.xml');
    const contentOpfPath = extractContentPath(containerXml);

    // Read content.opf
    const contentOpf = zip.readAsText(contentOpfPath);
    const { title, chapters } = parseOPF(contentOpf);

    // Read each chapter (XHTML files)
    const sections: string[] = [];

    if (title) {
      sections.push(`# ${title}\n`);
    }

    for (const chapter of chapters) {
      const chapterPath = resolvePath(contentOpfPath, chapter.path);
      const chapterContent = zip.readAsText(chapterPath);
      const chapterMD = xhtmlToMarkdown(chapterContent);

      sections.push(`## ${chapter.title || 'Chapter'}\n`);
      sections.push(chapterMD);
      sections.push('\n---\n');
    }

    return {
      content: sections.join('\n'),
      metadata: {
        title,
        chapters: chapters.length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse EPUB: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function extractContentPath(containerXml: string): string {
  // Simple regex to extract full-path from container.xml
  const match = containerXml.match(/full-path="([^"]+)"/);
  return match ? match[1] : 'OEBPS/content.opf';
}

function parseOPF(contentOpf: string): { title: string; chapters: Array<{ path: string; title?: string }> } {
  // Simple parsing - in production use proper XML parser
  const titleMatch = contentOpf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract spine items
  const chapters: Array<{ path: string; title?: string }> = [];

  // Simple approach: find all item elements with media-type="application/xhtml+xml"
  const itemMatches = contentOpf.matchAll(/<item[^>]*href="([^"]+)"[^>]*media-type="application\/xhtml\+xml"[^>]*\/>/gi);
  for (const match of itemMatches) {
    chapters.push({ path: match[1] });
  }

  return { title, chapters };
}

function resolvePath(basePath: string, relativePath: string): string {
  const baseDir = basePath.split('/').slice(0, -1).join('/');
  return baseDir ? `${baseDir}/${relativePath}` : relativePath;
}

function xhtmlToMarkdown(xhtml: string): string {
  // Simple approach: strip tags and clean up
  // In production use proper HTML parser
  let content = xhtml;

  // Remove script and style tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Convert common elements
  content = content.replace(/<h1[^>]*>([^<]*)<\/h1>/gi, '# $1\n');
  content = content.replace(/<h2[^>]*>([^<]*)<\/h2>/gi, '## $1\n');
  content = content.replace(/<h3[^>]*>([^<]*)<\/h3>/gi, '### $1\n');
  content = content.replace(/<h4[^>]*>([^<]*)<\/h4>/gi, '#### $1\n');
  content = content.replace(/<p[^>]*>([^<]*)<\/p>/gi, '$1\n\n');
  content = content.replace(/<br\s*\/?>/gi, '\n');

  // Convert strong/em
  content = content.replace(/<(strong|b)[^>]*>([^<]*)<\/\1>/gi, '**$2**');
  content = content.replace(/<(em|i)[^>]*>([^<]*)<\/\1>/gi, '*$2*');

  // Remove remaining tags
  content = content.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');

  // Clean up whitespace
  content = content.replace(/\n{3,}/g, '\n\n');

  return content.trim();
}
