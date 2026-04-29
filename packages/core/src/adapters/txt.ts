/**
 * Plain text adapter
 */

import type { ConvertOptions } from '../types';

export async function parseTXT(
  buffer: Buffer,
  _options?: ConvertOptions
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const content = buffer.toString('utf-8');

  // Clean up content
  const cleaned = cleanupText(content);

  return {
    content: cleaned,
  };
}

function cleanupText(text: string): string {
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Remove excessive whitespace at line ends
  text = text.replace(/[ \t]+$/gm, '');

  // Remove excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
