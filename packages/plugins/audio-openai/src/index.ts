/**
 * OpenAI Whisper plugin for audio transcription
 */

import OpenAI from 'openai';
import { writeFileSync, unlinkSync, rmSync, existsSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface TranscribeOptions {
  apiKey?: string;
  baseUrl?: string;
  lang?: string;
  timestamps?: boolean;
  signal?: AbortSignal;
}

interface TranscribeResult {
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

class AudioOpenAIPlugin {
  name = 'audio-openai';
  private client: OpenAI | null = null;
  private lastOptions: TranscribeOptions | null = null;

  async transcribe(buffer: Buffer, options?: TranscribeOptions): Promise<TranscribeResult> {
    // Check abort signal
    if (options?.signal?.aborted) {
      throw new Error('Transcription cancelled');
    }

    const client = this.getClient(options);

    // Write buffer to temp file (OpenAI API requires file)
    const tempDir = mkdtempSync(join(tmpdir(), 'switch-to-md-'));
    const audioPath = join(tempDir, 'audio.mp3');

    try {
      writeFileSync(audioPath, buffer);

      // Create File-like object
      const file = new File([buffer], 'audio.mp3', { type: 'audio/mpeg' });

      // Call Whisper API
      const transcription = await client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: options?.lang,
        response_format: options?.timestamps ? 'verbose_json' : 'text',
      });

      // Parse response
      if (typeof transcription === 'string') {
        return { text: transcription };
      }

      const text = transcription.text;
      const segments = (transcription as any).segments?.map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      }));

      return { text, segments };
    } finally {
      // Clean up temp directory recursively
      try {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
    }
  }

  private getClient(options?: TranscribeOptions): OpenAI {
    // Re-create client if options changed (different apiKey, baseUrl)
    const optionsChanged = !this.lastOptions ||
      this.lastOptions.apiKey !== options?.apiKey ||
      this.lastOptions.baseUrl !== options?.baseUrl;

    if (!this.client || optionsChanged) {
      this.client = new OpenAI({
        apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: options?.baseUrl,
      });
      this.lastOptions = options || {};
    }
    return this.client;
  }
}

export default new AudioOpenAIPlugin();
export { AudioOpenAIPlugin, type TranscribeOptions, type TranscribeResult };