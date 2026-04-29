/**
 * OpenAI Whisper plugin for audio transcription
 */

import OpenAI from 'openai';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface TranscribeOptions {
  apiKey?: string;
  baseUrl?: string;
  lang?: string;
  timestamps?: boolean;
}

interface TranscribeResult {
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

class AudioOpenAIPlugin {
  name = 'audio-openai';
  private client: OpenAI | null = null;

  async transcribe(buffer: Buffer, options?: TranscribeOptions): Promise<TranscribeResult> {
    const client = this.getClient(options);

    // Write buffer to temp file (OpenAI API requires file)
    const tempDir = mkdtempSync(join(tmpdir(), 'switch-to-md-'));
    const audioPath = join(tempDir, 'audio.mp3');

    try {
      writeFileSync(audioPath, buffer);

      // Create File-like object
      const file = await import('fs').then(fs => {
        const stats = fs.statSync(audioPath);
        return new File([buffer], 'audio.mp3', { type: 'audio/mpeg' });
      });

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
      try {
        unlinkSync(audioPath);
      } catch {}
    }
  }

  private getClient(options?: TranscribeOptions): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: options?.baseUrl,
      });
    }
    return this.client;
  }
}

export default new AudioOpenAIPlugin();
export { AudioOpenAIPlugin, type TranscribeOptions, type TranscribeResult };
