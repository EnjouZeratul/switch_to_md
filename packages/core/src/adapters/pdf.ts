/**
 * PDF adapter
 */

import type { ConvertOptions } from '../types';

// Dynamic import for pdf-parse (ESM compatibility)
let pdfParse: any = null;

async function getPdfParse() {
  if (!pdfParse) {
    pdfParse = await import('pdf-parse');
  }
  return pdfParse.default || pdfParse;
}

export async function parsePDF(
  buffer: Buffer,
  _options?: ConvertOptions
): Promise<{ content: string; metadata?: Record<string, any> }> {
  const parse = await getPdfParse();

  try {
    const data = await parse(buffer);

    // Extract text content
    let content = data.text;

    // Check if this might be a scanned PDF (very little text)
    const textLength = content.trim().length;
    const pageCount = data.numpages || 1;
    const avgCharsPerPage = textLength / pageCount;

    const warnings = [];

    if (avgCharsPerPage < 100) {
      // Likely a scanned PDF, needs OCR
      content = `[Warning: This PDF appears to be scanned or contains mostly images. Text content is minimal.\nConsider using vision plugin for OCR.]\n\n${content}`;
      warnings.push({
        type: 'missing_image' as const,
        location: 'document',
        message: 'PDF may be scanned, consider using vision plugin',
      });
    }

    // Clean up text
    content = cleanupText(content);

    return {
      content,
      metadata: {
        pages: data.numpages,
        info: data.info,
        warnings,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clean up extracted text
 */
function cleanupText(text: string): string {
  // Remove excessive whitespace
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  // Try to detect and preserve paragraph structure
  text = text.replace(/([.!?])\n([A-Z])/g, '$1\n\n$2');

  return text.trim();
}
