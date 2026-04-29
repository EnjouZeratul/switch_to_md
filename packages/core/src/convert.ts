/**
 * Main convert function
 */

import { readFile, writeFile } from 'fs/promises';
import { statSync } from 'fs';
import { basename, dirname, join, extname } from 'path';
import fg from 'fast-glob';
import { detectFileType, fileExists } from './detect';
import { getAdapter, needsPlugin, getSupportedFormats } from './router';
import { getVisionConfig, getAudioConfig, getConfig } from './config';
import { normalize } from './normalize';
import { configureCache, generateCacheKey, getCached, setCached, isCacheEnabled } from './cache';
import {
  UnsupportedFormatError,
  VisionNotConfiguredError,
  AudioNotConfiguredError,
  FileNotFoundError,
  CorruptedFileError,
  FileTooLargeError,
  AbortError,
  type CorruptedWarning,
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
  // Configure cache if options provided
  if (options?.cache) {
    if (typeof options.cache === 'boolean') {
      configureCache({ enabled: options.cache });
    } else {
      configureCache(options.cache);
    }
  }

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
  // Check for abort signal
  checkAbortSignal(options?.signal, 'Conversion cancelled before starting');

  // Check file exists
  if (!fileExists(path)) {
    throw new FileNotFoundError(path);
  }

  // Check file size
  const stats = statSync(path);
  const maxFileSize = options?.maxFileSize ?? 100 * 1024 * 1024; // Default 100MB
  if (stats.size > maxFileSize) {
    throw new FileTooLargeError(stats.size, maxFileSize);
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

  // Check cache
  if (isCacheEnabled()) {
    const config = getConfig();
    const configHash = JSON.stringify({
      provider: config.provider,
      vision: config.vision,
      audio: config.audio,
    });
    const cacheKey = generateCacheKey(path, buffer, configHash);
    const cached = getCached(cacheKey);

    if (cached) {
      if (options?.onProgress) {
        options.onProgress({ percent: 100, stage: 'cached', message: 'From cache' });
      }
      return {
        content: cached.content,
        source: path,
        type: detected.type,
        warnings: cached.metadata?.warnings,
      };
    }
  }

  // Report progress
  if (options?.onProgress) {
    options.onProgress({ percent: 10, stage: 'detect', message: `Detected: ${detected.type}` });
  }

  // Get adapter and parse
  let rawContent: string;
  let metadata: Record<string, any> = {};

  // Check abort signal before parsing
  checkAbortSignal(options?.signal, 'Conversion cancelled during parsing');

  const parsed = await parseWithAdapter(detected.type, buffer, {
    filename,
    options,
    detected,
    signal: options?.signal,
  });
  rawContent = parsed.content;
  metadata = parsed.metadata || {};

  // Check abort signal before normalization
  checkAbortSignal(options?.signal, 'Conversion cancelled during normalization');

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

  // Store in cache if enabled
  if (isCacheEnabled()) {
    const config = getConfig();
    const configHash = JSON.stringify({
      provider: config.provider,
      vision: config.vision,
      audio: config.audio,
    });
    const cacheKey = generateCacheKey(path, buffer, configHash);
    setCached(cacheKey, {
      content: normalized.content,
      metadata: {
        source: path,
        type: detected.type,
        timestamp: Date.now(),
      },
    });
  }

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
  // Check for abort signal
  checkAbortSignal(options?.signal, 'Conversion cancelled');

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
    signal: options?.signal,
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

  for (let i = 0; i < files.length; i++) {
    // Check abort signal between files
    checkAbortSignal(options?.signal, 'Batch conversion cancelled');

    try {
      const result = await convertFile(files[i], options);
      const filename = basename(files[i]);
      results[filename] = result.content;

      // Write to outputDir if specified
      if (options?.outputDir) {
        const outputPath = join(options.outputDir, `${basename(files[i], extname(files[i]))}.md`);
        await writeFile(outputPath, result.content, 'utf-8');
      }

      // Report batch progress
      if (options?.onProgress) {
        const percent = Math.round(((i + 1) / files.length) * 100);
        options.onProgress({
          percent,
          stage: 'batch',
          message: `Processed ${i + 1}/${files.length} files`
        });
      }
    } catch (error) {
      errors[files[i]] = error as Error;
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
    signal?: AbortSignal;
  }
): Promise<{ content: string; metadata?: Record<string, any> }> {
  // Check abort signal before parsing
  checkAbortSignal(context.signal, 'Conversion cancelled');

  switch (type) {
    case 'pdf':
      return parsePDF(buffer, context.signal);
    case 'docx':
      return parseDOCX(buffer, context.signal);
    case 'xlsx':
      return parseXLSX(buffer, context.signal);
    case 'pptx':
      return parsePPTX(buffer, context.signal);
    case 'txt':
      return parseTXT(buffer);
    case 'html':
      return parseHTML(buffer);
    case 'epub':
      return parseEPUB(buffer, context.signal);
    case 'svg':
      return parseSVG(buffer);
    case 'image':
      return parseImage(buffer, context.options, context.signal);
    case 'audio':
      return parseAudio(buffer, context.options, context.signal);
    case 'code':
      return parseCode(buffer, context.filename);
    default:
      throw new UnsupportedFormatError(type, getSupportedFormats());
  }
}

/**
 * Check if abort signal is triggered
 */
function checkAbortSignal(signal: AbortSignal | undefined, message: string): void {
  if (signal?.aborted) {
    throw new AbortError(message);
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
