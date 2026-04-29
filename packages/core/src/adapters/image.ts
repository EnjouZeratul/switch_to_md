/**
 * Image adapter - requires vision plugin
 */

import type { ConvertOptions } from '../types';
import { getVisionConfig } from '../config';
import { VisionNotConfiguredError } from '../errors';

// Plugin interface
interface VisionPlugin {
  name: string;
  analyze(buffer: Buffer, options?: any): Promise<{ text: string; description?: string }>;
}

// Cached plugin instance
let visionPlugin: VisionPlugin | null = null;

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
  options?: ConvertOptions
): Promise<{ content: string; metadata?: Record<string, any> }> {
  // Try to get plugin
  const plugin = await getVisionPlugin();

  if (!plugin) {
    throw new VisionNotConfiguredError();
  }

  // Get configuration
  const config = getVisionConfig();

  // Analyze image
  const result = await plugin.analyze(buffer, {
    lang: options?.images ? undefined : config?.lang,
  });

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
  if (visionPlugin) {
    return visionPlugin;
  }

  const config = getVisionConfig();

  if (!config) {
    return null;
  }

  // Load appropriate plugin based on config
  switch (config.provider) {
    case 'openai':
      try {
        const module = await import('@switch-to-md/vision-openai');
        visionPlugin = module.default || module;
        return visionPlugin;
      } catch {
        return null;
      }

    case 'anthropic':
      try {
        const module = await import('@switch-to-md/vision-anthropic');
        visionPlugin = module.default || module;
        return visionPlugin;
      } catch {
        return null;
      }

    case 'local':
      try {
        const module = await import('@switch-to-md/vision-local');
        visionPlugin = module.default || module;
        return visionPlugin;
      } catch {
        return null;
      }

    case 'custom':
      // Custom provider - user must register plugin manually
      return null;

    default:
      return null;
  }
}
