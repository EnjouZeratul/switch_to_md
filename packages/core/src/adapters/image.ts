/**
 * Image adapter - requires vision plugin
 */

import type { ConvertOptions, VisionPlugin } from '../types';
import { getVisionConfig } from '../config';
import { VisionNotConfiguredError, AbortError, sanitizeError } from '../errors';

// Cached plugin instance
let visionPlugin: VisionPlugin | null = null;
let cachedVisionConfigHash: string | null = null;

/**
 * Register a vision plugin
 */
export function registerVisionPlugin(plugin: VisionPlugin): void {
  visionPlugin = plugin;
}

/**
 * Parse image using configured vision backend
 */
export async function parseImage(
  buffer: Buffer,
  options?: ConvertOptions,
  signal?: AbortSignal
): Promise<{ content: string; metadata?: Record<string, any> }> {
  // Check abort signal
  if (signal?.aborted) {
    throw new AbortError('Image analysis cancelled');
  }

  // Try to get plugin
  const plugin = await getVisionPlugin();

  if (!plugin) {
    throw new VisionNotConfiguredError();
  }

  // Get configuration
  const config = getVisionConfig();

  // Build analyze options - use config lang if no specific image options
  const analyzeOptions = {
    lang: config?.lang || ['en'],
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl,
    model: config?.model,
    depth: 'visual-semantic',
    signal,
    timeout: config?.timeout,
  };

  // Analyze image
  const result = await plugin.analyze(buffer, analyzeOptions);

  // Build markdown output
  const lines: string[] = ['# Image\n'];

  if (result.text) {
    lines.push('## OCR Text\n');
    lines.push(result.text);
    lines.push('');
  }

  if (result.description) {
    lines.push('## Description\n');
    lines.push(result.description);
    lines.push('');
  }

  return {
    content: lines.join('\n'),
    metadata: {
      backend: plugin.name,
    },
  };
}

/**
 * Get or load vision plugin
 */
async function getVisionPlugin(): Promise<VisionPlugin | null> {
  const config = getVisionConfig();
  const configHash = JSON.stringify(config);

  // Return cached plugin if config hasn't changed
  if (visionPlugin && cachedVisionConfigHash === configHash) {
    return visionPlugin;
  }

  // Config changed or no plugin cached - reload
  visionPlugin = null;
  cachedVisionConfigHash = configHash;

  if (!config) {
    return null;
  }

  // Load appropriate plugin based on config
  let lastError: Error | undefined;

  switch (config.provider) {
    case 'openai':
      try {
        const module = await import('@switch-to-md/vision-openai');
        visionPlugin = module.default || module;
        return visionPlugin;
      } catch (error) {
        lastError = error as Error;
        throw new Error(
          `Failed to load @switch-to-md/vision-openai: ${lastError.message}. ` +
          `Please install it: npm install @switch-to-md/vision-openai`
        );
      }

    case 'anthropic':
      try {
        const module = await import('@switch-to-md/vision-anthropic');
        visionPlugin = module.default || module;
        return visionPlugin;
      } catch (error) {
        lastError = error as Error;
        throw new Error(
          `Failed to load @switch-to-md/vision-anthropic: ${lastError.message}. ` +
          `Please install it: npm install @switch-to-md/vision-anthropic`
        );
      }

    case 'local':
      try {
        const module = await import('@switch-to-md/vision-local');
        visionPlugin = module.default || module;
        return visionPlugin;
      } catch (error) {
        lastError = error as Error;
        throw new Error(
          `Failed to load @switch-to-md/vision-local: ${lastError.message}. ` +
          `Please install it: npm install @switch-to-md/vision-local`
        );
      }

    case 'custom':
      // Custom provider - user must register plugin manually
      return null;

    default:
      return null;
  }
}