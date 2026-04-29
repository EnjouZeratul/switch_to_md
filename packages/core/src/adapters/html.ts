/**
 * HTML adapter
 */

import type { ConvertOptions } from '../types';

let linkedom: any = null;

async function getDOMParser() {
  if (!linkedom) {
    linkedom = await import('linkedom');
  }
  return linkedom;
}

export async function parseHTML(
  buffer: Buffer,
  _options?: ConvertOptions
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const html = buffer.toString('utf-8');

  const { parseHTML } = await getDOMParser();
  const document = parseHTML(html);

  // Convert HTML to Markdown
  const markdown = htmlToMarkdown(document);

  // Extract title
  const title = document.querySelector('title')?.textContent || '';

  const content = title ? `# ${title}\n\n${markdown}` : markdown;

  return { content };
}

function htmlToMarkdown(document: Document): string {
  const body = document.body || document;
  return nodeToMarkdown(body, 0).join('\n');
}

function nodeToMarkdown(node: any, depth: number): string[] {
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
    case 'table': {
      const tableMD = tableToMarkdown(node);
      result.push(tableMD);
      break;
    }
    default:
      // Recursively process children
      for (const child of node.childNodes || []) {
        result.push(...nodeToMarkdown(child, depth + 1));
      }
  }

  // Add spacing after block elements
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'blockquote', 'pre', 'table', 'hr'].includes(tag)) {
    if (depth > 0) {
      result.push('');
    }
  }

  return result;
}

function getTextContent(node: any): string {
  return node.textContent?.trim() || '';
}

function tableToMarkdown(table: any): string {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return '';

  const lines: string[] = [];

  // Process header row
  const headerCells = rows[0].querySelectorAll('th, td');
  const headers = Array.from(headerCells).map((cell: any) => getTextContent(cell));
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  // Process body rows
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td, th');
    const rowData = Array.from(cells).map((cell: any) => getTextContent(cell));
    lines.push(`| ${rowData.join(' | ')} |`);
  }

  return lines.join('\n');
}
