/**
 * Format router - maps file types to adapters
 */

import type { FileType } from './types';

export interface AdapterInfo {
  name: string;
  formats: string[];
  needsPlugin?: 'vision' | 'audio';
}

// Adapter registry
const ADAPTERS: Record<FileType, AdapterInfo> = {
  pdf: { name: 'pdf', formats: ['pdf'] },
  docx: { name: 'docx', formats: ['docx', 'doc'] },
  xlsx: { name: 'xlsx', formats: ['xlsx', 'xls'] },
  pptx: { name: 'pptx', formats: ['pptx', 'ppt'] },
  txt: { name: 'txt', formats: ['txt', 'md', 'rtf'] },
  html: { name: 'html', formats: ['html', 'htm'] },
  epub: { name: 'epub', formats: ['epub'] },
  svg: { name: 'svg', formats: ['svg'] },
  image: { name: 'image', formats: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp'], needsPlugin: 'vision' },
  audio: { name: 'audio', formats: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'], needsPlugin: 'audio' },
  code: { name: 'code', formats: ['json', 'yaml', 'yml', 'xml', 'csv', 'sql', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'rb', 'php', 'sh'] },
  unknown: { name: 'unknown', formats: [] },
};

/**
 * Get adapter for a file type
 */
export function getAdapter(type: FileType): AdapterInfo {
  return ADAPTERS[type] || ADAPTERS.unknown;
}

/**
 * Check if adapter needs a plugin
 */
export function needsPlugin(type: FileType): 'vision' | 'audio' | null {
  const adapter = ADAPTERS[type];
  return adapter?.needsPlugin || null;
}

/**
 * Get all supported formats
 */
export function getSupportedFormats(): string[] {
  const formats: string[] = [];
  for (const adapter of Object.values(ADAPTERS)) {
    formats.push(...adapter.formats);
  }
  return formats;
}

/**
 * Check if a format is supported
 */
export function isFormatSupported(ext: string): boolean {
  const formats = getSupportedFormats();
  return formats.includes(ext.toLowerCase());
}