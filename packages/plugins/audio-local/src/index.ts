/**
 * Local audio plugin using Whisper.cpp
 * Requires whisper.cpp to be installed and available in PATH
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync, existsSync, rmdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface TranscribeOptions {
  lang?: string;
  model?: string;  // base, small, medium, large
  timestamps?: boolean;
}

interface TranscribeResult {
  text: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

class AudioLocalPlugin {
  name = 'audio-local';
  private whisperPath: string;

  constructor(whisperPath: string = 'whisper') {
    this.whisperPath = whisperPath;
  }

  async transcribe(buffer: Buffer, options?: TranscribeOptions): Promise<TranscribeResult> {
    // Create temp directory
    const tempDir = mkdtempSync(join(tmpdir(), 'switch-to-md-'));
    const audioPath = join(tempDir, 'audio.wav');
    const outputPath = join(tempDir, 'output');

    try {
      // Write buffer to temp file
      writeFileSync(audioPath, buffer);

      // Build whisper command
      const args = [
        '-f', audioPath,
        '-otxt',
        '-of', outputPath,
      ];

      if (options?.lang) {
        args.push('-l', options.lang);
      }

      if (options?.model) {
        args.push('-m', options.model);
      }

      if (options?.timestamps !== false) {
        args.push('--output-srt');
      }

      // Run whisper
      const result = await this.runWhisper(args);

      // Parse output
      return this.parseOutput(result, outputPath);
    } finally {
      // Cleanup temp files
      try {
        unlinkSync(audioPath);
        if (existsSync(`${outputPath}.txt`)) unlinkSync(`${outputPath}.txt`);
        if (existsSync(`${outputPath}.srt`)) unlinkSync(`${outputPath}.srt`);
        // Try to remove temp directory if empty
        try {
          rmdirSync(tempDir);
        } catch {}
      } catch {}
    }
  }

  private runWhisper(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.whisperPath, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout + stderr);
        } else {
          reject(new Error(`Whisper failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run whisper: ${err.message}`));
      });
    });
  }

  private parseOutput(output: string, outputPath: string): TranscribeResult {
    let text = '';
    const segments: Array<{ start: number; end: number; text: string }> = [];

    try {
      text = readFileSync(`${outputPath}.txt`, 'utf-8').trim();
    } catch {
      text = output;
    }

    // Try to parse SRT for segments if available
    try {
      const srtPath = `${outputPath}.srt`;
      const srtContent = readFileSync(srtPath, 'utf-8');

      // Parse SRT format
      const blocks = srtContent.split('\n\n');
      for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length >= 3) {
          const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
          if (timeMatch) {
            const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
            const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
            const segmentText = lines.slice(2).join(' ').trim();
            segments.push({ start, end, text: segmentText });
          }
        }
      }
    } catch {
      // SRT not available
    }

    return { text, segments: segments.length > 0 ? segments : undefined };
  }
}

export default new AudioLocalPlugin();
export { AudioLocalPlugin, type TranscribeOptions, type TranscribeResult };
