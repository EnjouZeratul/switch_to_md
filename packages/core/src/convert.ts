/**
 * Main convert function
 */

import { readFile, writeFile } from 'fs/promises';
import { basename, dirname, join, extname } from 'path';
import fg from 'fast-glob';
import { detectFileType, fileExists } from './detect';
import { getAdapter, needsPlugin, getSupportedFormats } from './router';
import { getVisionConfig, getAudioConfig } from './config';
import { normalize } from './normalize';
import {
  UnsupportedFormatError,
  VisionNotConfiguredError,
  AudioNotConfiguredError,
  FileNotFoundError,
} from './errors';
import type { ConvertOptions, BatchResult, ProgressInfo, ConvertResult, FileType } from './types';

// Adapter imports
import {
  parsePDF,
  parseDOCX,
  parseXLSX,
  parsePPTX,
  parseTXT,
  parseHTML,
  parseEPUB,
  parseSVG,
  parseImage,
  parseAudio,
  parseCode,
} from './adapters';

/**
 * Convert file(s) to Markdown
 */
export async function convert(
  input: string | string[] | Buffer,
  options?: ConvertOptions
): Promise<string | BatchResult> {
  // Handle buffer input
  if (Buffer.isBuffer(input)) {
    const result = await convertBuffer(input, options);
    return result.content;
  }

  // Handle single file
  if (typeof input === 'string') {
    // Check if it's a glob pattern
    if (input.includes('*') || input.includes('?')) {
      const files = await expandGlob(input);
      if (files.length === 1) {
        const result = await convertFile(files[0], options);
        return result.content;
      }
      return convertBatch(files, options);
    }

    const result = await convertFile(input, options);

    // Write to file if output option specified
    if (options?.output) {
      await writeFile(options.output, result.content, 'utf-8');
    }

    return result.content;
  }

  // Handle batch
  return convertBatch(input, options);
}

/**
 * Convert a single file
 */
async function convertFile(
  path: string,
  options?: ConvertOptions
): Promise<ConvertResult> {
  // Check file exists
  if (!fileExists(path)) {
    throw new FileNotFoundError(path);
  }

  // Detect file type
  const detected = detectFileType(path);

  // Check if format is supported
  if (detected.type === 'unknown') {
    throw new UnsupportedFormatError(detected.ext, getSupportedFormats());
  }

  // Check if plugin is needed
  const pluginType = needsPlugin(detected.type);
  if (pluginType === 'vision') {
    const config = getVisionConfig();
    if (!config) {
      throw new VisionNotConfiguredError();
    }
  } else if (pluginType === 'audio') {
    const config = getAudioConfig();
    if (!config) {
      throw new AudioNotConfiguredError();
    }
  }

  // Read file
  const buffer = await readFile(path);
  const filename = basename(path);

  // Report progress
  if (options?.onProgress) {
    options.onProgress({ percent: 10, stage: 'detect', message: `Detected: ${detected.type}` });
  }

  // Get adapter and parse
  const adapter = getAdapter(detected.type);
  let rawContent: string;
  let metadata: Record<string, any> = {};

  const parsed = await parseWithAdapter(detected.type, buffer, {
    filename,
    options,
    detected,
  });
  rawContent = parsed.content;
  metadata = parsed.metadata || {};

  // Report progress
  if (options?.onProgress) {
    options.onProgress({ percent: 80, stage: 'normalize', message: 'Normalizing output' });
  }

  // Normalize to standard Markdown
  const normalized = normalize(rawContent, filename, detected.type, {
    pages: metadata.pages,
    backend: metadata.backend,
    warnings: metadata.warnings,
  });

  // Report progress
  if (options?.onProgress) {
    options.onProgress({ percent: 100, stage: 'complete', message: 'Done' });
  }

  return {
    content: normalized.content,
    source: path,
    type: detected.type,
    warnings: normalized.warnings,
  };
}

/**
 * Convert buffer input
 */
async function convertBuffer(
  buffer: Buffer,
  options?: ConvertOptions
): Promise<ConvertResult> {
  const detected = detectFileType(buffer);

  if (detected.type === 'unknown') {
    throw new UnsupportedFormatError(detected.ext || 'unknown', getSupportedFormats());
  }

  const pluginType = needsPlugin(detected.type);
  if (pluginType === 'vision' && !getVisionConfig()) {
    throw new VisionNotConfiguredError();
  }
  if (pluginType === 'audio' && !getAudioConfig()) {
    throw new AudioNotConfiguredError();
  }

  const parsed = await parseWithAdapter(detected.type, buffer, {
    filename: 'buffer',
    options,
    detected,
  });

  const normalized = normalize(parsed.content, 'buffer', detected.type, {
    pages: parsed.metadata?.pages,
    backend: parsed.metadata?.backend,
  });

  return {
    content: normalized.content,
    source: 'buffer',
    type: detected.type,
  };
}

/**
 * Convert multiple files
 */
async function convertBatch(
  files: string[],
  options?: ConvertOptions
): Promise<BatchResult> {
  const results: Record<string, string> = {};
  const errors: Record<string, Error> = {};

  for (const file of files) {
    try {
      const result = await convertFile(file, options);
      const filename = basename(file);
      results[filename] = result.content;

      // Write to outputDir if specified
      if (options?.outputDir) {
        const outputPath = join(options.outputDir, `${basename(file, extname(file))}.md`);
        await writeFile(outputPath, result.content, 'utf-8');
      }
    } catch (error) {
      errors[file] = error as Error;
    }
  }

  return {
    files: results,
    errors,
    summary: {
      total: files.length,
      success: Object.keys(results).length,
      failed: Object.keys(errors).length,
    },
  };
}

/**
 * Parse with appropriate adapter
 */
async function parseWithAdapter(
  type: FileType,
  buffer: Buffer,
  context: {
    filename: string;
    options?: ConvertOptions;
    detected: ReturnType<typeof detectFileType>;
  }
): Promise<{ content: string; metadata?: Record<string, any> }> {
  switch (type) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
      return parseDOCX(buffer);
    case 'xlsx':
      return parseXLSX(buffer);
    case 'pptx':
      return parsePPTX(buffer);
    case 'txt':
      return parseTXT(buffer);
    case 'html':
      return parseHTML(buffer);
    case 'epub':
      return parseEPUB(buffer);
    case 'svg':
      return parseSVG(buffer);
    case 'image':
      return parseImage(buffer, context.options);
    case 'audio':
      return parseAudio(buffer, context.options);
    case 'code':
      return parseCode(buffer, context.filename);
    default:
      throw new UnsupportedFormatError(type, getSupportedFormats());
  }
}

/**
 * Expand glob pattern using fast-glob
 */
async function expandGlob(pattern: string): Promise<string[]> {
  try {
    const files = await fg(pattern, {
      absolute: true,
      onlyFiles: true,
    });
    return files;
  } catch {
    return [];
  }
}

// Re-export types
export type { ConvertOptions, BatchResult, ProgressInfo };