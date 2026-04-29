/**
 * Audio adapter - requires audio plugin
 */

import type { ConvertOptions, AudioPlugin } from '../types';
import { getAudioConfig } from '../config';
import { AudioNotConfiguredError } from '../errors';

// Cached plugin instance
let audioPlugin: AudioPlugin | null = null;

/**
 * Register an audio plugin
 */
export function registerAudioPlugin(plugin: AudioPlugin): void {
  audioPlugin = plugin;
}

/**
 * Parse audio using configured audio backend
 */
export async function parseAudio(
  buffer: Buffer,
  options?: ConvertOptions,
  signal?: AbortSignal
): Promise<{ content: string; metadata?: Record<string, any> }> {
  // Check abort signal
  if (signal?.aborted) {
    const error = new Error('Audio transcription cancelled');
    error.name = 'AbortError';
    throw error;
  }

  // Try to get plugin
  const plugin = await getAudioPlugin();

  if (!plugin) {
    throw new AudioNotConfiguredError();
  }

  // Get configuration
  const config = getAudioConfig();

  // Build transcribe options
  const transcribeOptions = {
    lang: config?.lang || 'en',
    timestamps: true,
    apiKey: config?.apiKey,
    baseUrl: config?.baseUrl,
    model: config?.model,
    signal,
  };

  // Transcribe audio
  const result = await plugin.transcribe(buffer, transcribeOptions);

  // Build markdown output
  const lines: string[] = ['# Audio Transcription\n'];

  if (result.text) {
    lines.push('## Full Text\n');
    lines.push(result.text);
    lines.push('');
  }

  if (result.segments && result.segments.length > 0) {
    lines.push('## Timestamps\n');
    for (const segment of result.segments) {
      const startTime = formatTime(segment.start);
      const endTime = formatTime(segment.end);
      lines.push(`[${startTime} - ${endTime}] ${segment.text}`);
    }
    lines.push('');
  }

  return {
    content: lines.join('\n'),
    metadata: {
      backend: plugin.name,
      segments: result.segments?.length || 0,
    },
  };
}

/**
 * Get or load audio plugin
 */
async function getAudioPlugin(): Promise<AudioPlugin | null> {
  if (audioPlugin) {
    return audioPlugin;
  }

  const config = getAudioConfig();

  if (!config) {
    return null;
  }

  // Load appropriate plugin based on config
  switch (config.provider) {
    case 'openai':
      try {
        const module = await import('@switch-to-md/audio-openai');
        audioPlugin = module.default || module;
        return audioPlugin;
      } catch {
        return null;
      }

    case 'local':
      try {
        const module = await import('@switch-to-md/audio-local');
        audioPlugin = module.default || module;
        return audioPlugin;
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

/**
 * Format seconds to HH:MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}