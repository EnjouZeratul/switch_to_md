#!/usr/bin/env node

/**
 * switch-to-md CLI
 */

import { program } from 'commander';
import { convert, configure } from 'switch-to-md';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, basename, extname, join } from 'path';

program
  .name('switch-to-md')
  .description('Convert any file to Markdown')
  .version('0.1.0');

// Convert command
program
  .command('convert <files...>')
  .description('Convert files to Markdown')
  .option('-o, --output <path>', 'Output file or directory')
  .option('--provider <provider>', 'Model provider (openai, anthropic, local)')
  .option('--api-key <key>', 'API key for cloud provider')
  .option('--verbose', 'Show progress')
  .action(async (files: string[], options: any) => {
    // Configure if options provided
    if (options.provider || options.apiKey) {
      configure({
        provider: options.provider,
        apiKey: options.apiKey,
      });
    }

    // Process files
    for (const file of files) {
      if (!existsSync(file)) {
        console.error(`Error: File not found: ${file}`);
        continue;
      }

      try {
        console.log(`Converting: ${file}`);

        const result = await convert(file, {
          output: options.output,
          onProgress: options.verbose ? (p) => console.log(`  ${p.stage}: ${p.percent}%`) : undefined,
        });

        // Handle output
        if (typeof result === 'string') {
          if (options.output) {
            // If output is a directory, create file there
            if (existsSync(options.output) && !options.output.endsWith('.md')) {
              const outputPath = join(options.output, `${basename(file, extname(file))}.md`);
              writeFileSync(outputPath, result, 'utf-8');
              console.log(`  Saved to: ${outputPath}`);
            } else {
              writeFileSync(options.output, result, 'utf-8');
              console.log(`  Saved to: ${options.output}`);
            }
          } else {
            console.log(result);
          }
        }
      } catch (error) {
        console.error(`Error converting ${file}:`, error instanceof Error ? error.message : String(error));
      }
    }
  });

// Setup command
program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    console.log('switch-to-md Setup Wizard');
    console.log('');
    console.log('This will help you configure vision/audio backends.');
    console.log('');
    console.log('Options:');
    console.log('  1. OpenAI (gpt-4o vision, whisper audio)');
    console.log('  2. Anthropic Claude Vision');
    console.log('  3. Local models (Tesseract, Whisper.cpp)');
    console.log('  4. Custom endpoint');
    console.log('');
    console.log('Please set environment variables:');
    console.log('');
    console.log('  # For OpenAI:');
    console.log('  SWITCH_TO_MD_PROVIDER=openai');
    console.log('  SWITCH_TO_MD_API_KEY=sk-xxx');
    console.log('');
    console.log('  # For local models:');
    console.log('  npm i @switch-to-md/vision-local');
    console.log('  npm i @switch-to-md/audio-local');
    console.log('');
    console.log('Or create a switch-to-md.config.ts file in your project.');
  });

// Formats command
program
  .command('formats')
  .description('List supported formats')
  .action(() => {
    console.log('Supported formats:');
    console.log('');
    console.log('Documents:');
    console.log('  PDF, DOCX, XLSX, PPTX, TXT, HTML, EPUB, SVG');
    console.log('');
    console.log('Images (requires vision plugin):');
    console.log('  PNG, JPG, GIF, BMP, TIFF, WebP');
    console.log('');
    console.log('Audio (requires audio plugin):');
    console.log('  MP3, WAV, FLAC, OGG, M4A');
    console.log('');
    console.log('Code/Config:');
    console.log('  JSON, YAML, XML, CSV, SQL, JS, TS, PY, etc.');
  });

program.parse();