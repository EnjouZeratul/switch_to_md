/**
 * File type detection
 */

import { statSync, openSync, readSync, closeSync, alloc } from 'fs';
import { extname } from 'path';
import type { FileType, FileInfo } from './types';

export interface DetectResult {
  type: FileType;
  mime: string;
  ext: string;
  needsVision: boolean;
  needsAudio: boolean;
}

// MIME type mapping
const EXT_TO_MIME: Record<string, { mime: string; type: FileType }> = {
  // Documents
  '.pdf': { mime: 'application/pdf', type: 'pdf' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', type: 'docx' },
  '.doc': { mime: 'application/msword', type: 'docx' },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', type: 'xlsx' },
  '.xls': { mime: 'application/vnd.ms-excel', type: 'xlsx' },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', type: 'pptx' },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', type: 'pptx' },

  // Text
  '.txt': { mime: 'text/plain', type: 'txt' },
  '.md': { mime: 'text/markdown', type: 'txt' },
  '.rtf': { mime: 'application/rtf', type: 'txt' },
  '.html': { mime: 'text/html', type: 'html' },
  '.htm': { mime: 'text/html', type: 'html' },

  // Ebook
  '.epub': { mime: 'application/epub+zip', type: 'epub' },

  // Images
  '.png': { mime: 'image/png', type: 'image' },
  '.jpg': { mime: 'image/jpeg', type: 'image' },
  '.jpeg': { mime: 'image/jpeg', type: 'image' },
  '.gif': { mime: 'image/gif', type: 'image' },
  '.bmp': { mime: 'image/bmp', type: 'image' },
  '.tiff': { mime: 'image/tiff', type: 'image' },
  '.tif': { mime: 'image/tiff', type: 'image' },
  '.webp': { mime: 'image/webp', type: 'image' },

  // Audio
  '.mp3': { mime: 'audio/mpeg', type: 'audio' },
  '.wav': { mime: 'audio/wav', type: 'audio' },
  '.flac': { mime: 'audio/flac', type: 'audio' },
  '.ogg': { mime: 'audio/ogg', type: 'audio' },
  '.m4a': { mime: 'audio/mp4', type: 'audio' },
  '.aac': { mime: 'audio/aac', type: 'audio' },

  // Vector
  '.svg': { mime: 'image/svg+xml', type: 'svg' },

  // Code
  '.json': { mime: 'application/json', type: 'code' },
  '.yaml': { mime: 'application/yaml', type: 'code' },
  '.yml': { mime: 'application/yaml', type: 'code' },
  '.xml': { mime: 'application/xml', type: 'code' },
  '.csv': { mime: 'text/csv', type: 'code' },
  '.sql': { mime: 'application/sql', type: 'code' },
  '.js': { mime: 'application/javascript', type: 'code' },
  '.ts': { mime: 'application/typescript', type: 'code' },
  '.py': { mime: 'text/x-python', type: 'code' },
  '.java': { mime: 'text/x-java', type: 'code' },
  '.c': { mime: 'text/x-c', type: 'code' },
  '.cpp': { mime: 'text/x-c++', type: 'code' },
  '.go': { mime: 'text/x-go', type: 'code' },
  '.rs': { mime: 'text/x-rust', type: 'code' },
  '.rb': { mime: 'text/x-ruby', type: 'code' },
  '.php': { mime: 'text/x-php', type: 'code' },
  '.sh': { mime: 'text/x-shellscript', type: 'code' },
};

// Magic bytes for file detection
const MAGIC_BYTES: Array<{ bytes: number[]; mime: string; type: FileType }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf', type: 'pdf' }, // %PDF
  { bytes: [0x50, 0x4B, 0x03, 0x04], mime: 'application/zip', type: 'unknown' }, // ZIP (DOCX, XLSX, PPTX, EPUB)
  { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png', type: 'image' }, // PNG
  { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg', type: 'image' }, // JPEG
  { bytes: [0x47, 0x49, 0x46], mime: 'image/gif', type: 'image' }, // GIF
  { bytes: [0x42, 0x4D], mime: 'image/bmp', type: 'image' }, // BMP
  { bytes: [0x49, 0x44, 0x33], mime: 'audio/mpeg', type: 'audio' }, // MP3 ID3
  { bytes: [0xFF, 0xFB], mime: 'audio/mpeg', type: 'audio' }, // MP3
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav', type: 'audio' }, // WAV
  { bytes: [0x66, 0x4C, 0x61, 0x43], mime: 'audio/flac', type: 'audio' }, // FLAC
];

/**
 * Detect file type from path or buffer
 */
export function detectFileType(input: string | Buffer): DetectResult {
  let ext: string;
  let buffer: Buffer | undefined;

  if (typeof input === 'string') {
    ext = extname(input).toLowerCase();

    // Try to read first few bytes for magic number detection
    try {
      const fd = openSync(input, 'r');
      buffer = Buffer.alloc(32);
      try {
        readSync(fd, buffer, 0, 32, 0);
      } finally {
        // Always close fd, even if readSync fails
        closeSync(fd);
      }
    } catch {
      // File doesn't exist or can't be read, rely on extension
    }
  } else {
    buffer = input;
    ext = '';
  }

  // First try magic bytes detection
  if (buffer) {
    const magicResult = detectByMagicBytes(buffer);
    if (magicResult) {
      // For ZIP-based formats, we still need extension to differentiate
      if (magicResult.type === 'unknown' && ext) {
        const extResult = EXT_TO_MIME[ext];
        if (extResult) {
          return {
            type: extResult.type,
            mime: extResult.mime,
            ext: ext.replace('.', ''),
            needsVision: extResult.type === 'image',
            needsAudio: extResult.type === 'audio',
          };
        }
      }

      return {
        type: magicResult.type,
        mime: magicResult.mime,
        ext: ext.replace('.', ''),
        needsVision: magicResult.type === 'image',
        needsAudio: magicResult.type === 'audio',
      };
    }
  }

  // Fall back to extension
  if (ext) {
    const extResult = EXT_TO_MIME[ext];
    if (extResult) {
      return {
        type: extResult.type,
        mime: extResult.mime,
        ext: ext.replace('.', ''),
        needsVision: extResult.type === 'image',
        needsAudio: extResult.type === 'audio',
      };
    }
  }

  // Unknown format
  return {
    type: 'unknown',
    mime: 'application/octet-stream',
    ext: ext.replace('.', ''),
    needsVision: false,
    needsAudio: false,
  };
}

function detectByMagicBytes(buffer: Buffer): { mime: string; type: FileType } | null {
  for (const magic of MAGIC_BYTES) {
    let match = true;
    for (let i = 0; i < magic.bytes.length; i++) {
      if (buffer[i] !== magic.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return { mime: magic.mime, type: magic.type };
    }
  }
  return null;
}

/**
 * Check if file exists
 */
export function fileExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
