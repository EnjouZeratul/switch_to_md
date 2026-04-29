/**
 * EPUB adapter
 */

let AdmZip: any = null;
let linkedom: any = null;

async function getLibs() {
  if (!AdmZip) {
    AdmZip = (await import('adm-zip')).default || (await import('adm-zip'));
  }
  if (!linkedom) {
    linkedom = await import('linkedom');
  }
  return { AdmZip, linkedom };
}

export async function parseEPUB(
  buffer: Buffer,
  signal?: AbortSignal
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const { AdmZip, linkedom } = await getLibs();

  // Check abort signal
  if (signal?.aborted) {
    const error = new Error('EPUB parsing cancelled');
    error.name = 'AbortError';
    throw error;
  }

  try {
    const zip = new AdmZip(buffer);

    // Read container.xml to find content.opf location
    const containerXml = zip.readAsText('META-INF/container.xml');
    const contentOpfPath = extractContentPath(containerXml, linkedom);

    // Read content.opf
    const contentOpf = zip.readAsText(contentOpfPath);
    const { title, chapters } = parseOPF(contentOpf, linkedom);

    // Read each chapter (XHTML files)
    const sections: string[] = [];

    if (title) {
      sections.push(`# ${title}\n`);
    }

    for (const chapter of chapters) {
      // Check abort signal between chapters
      if (signal?.aborted) {
        const error = new Error('EPUB parsing cancelled');
        error.name = 'AbortError';
        throw error;
      }

      const chapterPath = resolvePath(contentOpfPath, chapter.path);
      const chapterContent = zip.readAsText(chapterPath);
      const chapterMD = xhtmlToMarkdown(chapterContent, linkedom);

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
    if ((error as Error).name === 'AbortError') {
      throw error;
    }
    throw new Error(`Failed to parse EPUB: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function extractContentPath(containerXml: string, linkedom: any): string {
  try {
    const { parseHTML } = linkedom;
    const doc = parseHTML(containerXml);
    const rootfile = doc.querySelector('rootfile');
    if (rootfile) {
      return rootfile.getAttribute('full-path') || 'OEBPS/content.opf';
    }
  } catch {}
  // Fallback to simple regex
  const match = containerXml.match(/full-path="([^"]+)"/);
  return match ? match[1] : 'OEBPS/content.opf';
}

function parseOPF(contentOpf: string, linkedom: any): { title: string; chapters: Array<{ path: string; title?: string }> } {
  const chapters: Array<{ path: string; title?: string }> = [];
  let title = '';

  try {
    const { parseHTML } = linkedom;
    const doc = parseHTML(contentOpf);

    // Extract title
    const titleEl = doc.querySelector('dc\\:title, title');
    if (titleEl) {
      title = titleEl.textContent?.trim() || '';
    }

    // Extract manifest items
    const items = doc.querySelectorAll('manifest item');
    for (const item of items) {
      const mediaType = item.getAttribute('media-type');
      const href = item.getAttribute('href');
      if (mediaType === 'application/xhtml+xml' && href) {
        chapters.push({ path: href });
      }
    }
  } catch {
    // Fallback to regex
    const titleMatch = contentOpf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    title = titleMatch ? titleMatch[1].trim() : '';

    const itemMatches = contentOpf.matchAll(/<item[^>]*href="([^"]+)"[^>]*media-type="application\/xhtml\+xml"[^>]*\/>/gi);
    for (const match of itemMatches) {
      chapters.push({ path: match[1] });
    }
  }

  return { title, chapters };
}

function resolvePath(basePath: string, relativePath: string): string {
  const baseDir = basePath.split('/').slice(0, -1).join('/');
  return baseDir ? `${baseDir}/${relativePath}` : relativePath;
}

function xhtmlToMarkdown(xhtml: string, linkedom: any): string {
  try {
    const { parseHTML } = linkedom;
    const doc = parseHTML(xhtml);
    const body = doc.body || doc;

    return nodeToMarkdown(body).join('\n');
  } catch {
    // Fallback to simple approach
    return fallbackXhtmlToMarkdown(xhtml);
  }
}

function nodeToMarkdown(node: any): string[] {
  const result: string[] = [];

  if (node.nodeType === 3) { // Text node
    const text = node.textContent?.trim();
    if (text) {
      result.push(text);
    }
    return result;
  }

  if (node.nodeType !== 1) { // Not an element
    return result;
  }

  const tag = node.tagName?.toLowerCase();

  switch (tag) {
    case 'h1':
      result.push(`# ${getTextContent(node)}`);
      break;
    case 'h2':
      result.push(`## ${getTextContent(node)}`);
      break;
    case 'h3':
      result.push(`### ${getTextContent(node)}`);
      break;
    case 'h4':
      result.push(`#### ${getTextContent(node)}`);
      break;
    case 'h5':
      result.push(`##### ${getTextContent(node)}`);
      break;
    case 'h6':
      result.push(`###### ${getTextContent(node)}`);
      break;
    case 'p':
      result.push(getTextContent(node));
      break;
    case 'br':
      result.push('\n');
      break;
    case 'hr':
      result.push('---');
      break;
    case 'ul':
    case 'ol': {
      const items = node.querySelectorAll('li');
      items.forEach((li: any, i: number) => {
        const prefix = tag === 'ul' ? '-' : `${i + 1}.`;
        result.push(`${prefix} ${getTextContent(li)}`);
      });
      break;
    }
    case 'blockquote': {
      const text = getTextContent(node);
      result.push(...text.split('\n').map(line => `> ${line}`));
      break;
    }
    case 'code':
      result.push(`\`${getTextContent(node)}\``);
      break;
    case 'pre':
      result.push(`\`\`\`\n${getTextContent(node)}\n\`\`\``);
      break;
    case 'strong':
    case 'b':
      result.push(`**${getTextContent(node)}**`);
      break;
    case 'em':
    case 'i':
      result.push(`*${getTextContent(node)}*`);
      break;
    case 'a': {
      const href = node.getAttribute('href') || '';
      const text = getTextContent(node);
      result.push(`[${text}](${href})`);
      break;
    }
    case 'img': {
      const alt = node.getAttribute('alt') || '';
      const src = node.getAttribute('src') || '';
      result.push(`![${alt}](${src})`);
      break;
    }
    default:
      // Recursively process children
      for (const child of node.childNodes || []) {
        result.push(...nodeToMarkdown(child));
      }
  }

  return result;
}

function getTextContent(node: any): string {
  return node.textContent?.trim() || '';
}

function fallbackXhtmlToMarkdown(xhtml: string): string {
  let content = xhtml;

  // Remove script and style tags
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Convert common elements
  content = content.replace(/<h1[^>]*>([^<]*)<\/h1>/gi, '# $1\n');
  content = content.replace(/<h2[^>]*>([^<]*)<\/h2>/gi, '## $1\n');
  content = content.replace(/<h3[^>]*>([^<]*)<\/h3>/gi, '### $1\n');
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