/**
 * Code adapter for source files and config files
 */

import type { ConvertOptions } from '../types';

// Language mapping for syntax highlighting
const LANG_MAP: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'bash',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  graphql: 'graphql',
  gql: 'graphql',
};

export async function parseCode(
  buffer: Buffer,
  filename: string
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const code = buffer.toString('utf-8');

  // Detect language from extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const lang = LANG_MAP[ext] || ext;

  // Build markdown
  const lines: string[] = [`# ${filename}\n`];

  // Add file info
  const linesCount = code.split('\n').length;
  const size = buffer.length;
  lines.push(`> ${linesCount} lines, ${formatSize(size)}\n`);

  // Add code block
  lines.push(`\`\`\`${lang}`);
  lines.push(code);
  lines.push('```\n');

  // For JSON/YAML, add parsed summary if valid
  if (ext === 'json') {
    const summary = summarizeJSON(code);
    if (summary) {
      lines.push('## Structure\n');
      lines.push(summary);
    }
  }

  return { content: lines.join('\n') };
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Summarize JSON structure
 */
function summarizeJSON(code: string): string | null {
  try {
    const obj = JSON.parse(code);
    return describeValue(obj, 0);
  } catch {
    return null;
  }
}

function describeValue(value: any, depth: number): string {
  if (depth > 3) return '...';

  const indent = '  '.repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}- []`;
    if (value.length <= 5) {
      return value.map((v, i) => `${indent}- [${i}]: ${getTypeName(v)}`).join('\n');
    }
    return `${indent}- Array(${value.length}): ${getTypeName(value[0])}`;
  }

  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    if (keys.length === 0) return `${indent}- {}`;
    if (keys.length <= 10) {
      return keys.map(k => `${indent}- ${k}: ${getTypeName(value[k])}`).join('\n');
    }
    return `${indent}- Object(${keys.length} keys)`;
  }

  return `${indent}- ${getTypeName(value)}`;
}

function getTypeName(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `Object(${Object.keys(value).length})`;
  return typeof value;
}
