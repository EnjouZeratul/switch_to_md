/**
 * Anthropic Claude Vision plugin
 */

import Anthropic from '@anthropic-ai/sdk';

interface AnalyzeOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  lang?: string[];
  depth?: 'ocr' | 'visual-semantic';
  signal?: AbortSignal;
}

interface AnalyzeResult {
  text: string;
  description?: string;
  tables?: any[];
  formulas?: any[];
}

class VisionAnthropicPlugin {
  name = 'vision-anthropic';
  private client: Anthropic | null = null;
  private lastOptions: AnalyzeOptions | null = null;

  async analyze(buffer: Buffer, options?: AnalyzeOptions): Promise<AnalyzeResult> {
    // Check abort signal
    if (options?.signal?.aborted) {
      throw new Error('Vision analysis cancelled');
    }

    const client = this.getClient(options);

    // Convert buffer to base64
    const base64 = buffer.toString('base64');
    const mimeType = this.detectMimeType(buffer);

    // Build prompt based on depth
    const prompt = this.buildPrompt(options);

    // Call Claude Vision API
    const response = await client.messages.create({
      model: options?.model || 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as any,
                data: base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract text from response
    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('\n');

    return this.parseResponse(content);
  }

  private getClient(options?: AnalyzeOptions): Anthropic {
    // Re-create client if options changed (different apiKey, baseUrl)
    const optionsChanged = !this.lastOptions ||
      this.lastOptions.apiKey !== options?.apiKey ||
      this.lastOptions.baseUrl !== options?.baseUrl;

    if (!this.client || optionsChanged) {
      this.client = new Anthropic({
        apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: options?.baseUrl,
      });
      this.lastOptions = options || {};
    }
    return this.client;
  }

  private buildPrompt(options?: AnalyzeOptions): string {
    const langHint = options?.lang ? ` (prefer ${options.lang.join(', ')})` : '';

    if (options?.depth === 'visual-semantic') {
      return `Analyze this image thoroughly. Provide:
1. All visible text (OCR)${langHint}
2. A description of any charts, diagrams, or visual elements
3. Extract any tables in markdown format
4. Transcribe any mathematical formulas in LaTeX notation

Format your response as:
## OCR Text
[extracted text]

## Description
[visual description]

## Tables
[markdown tables if any]

## Formulas
[LaTeX formulas if any]`;
    }

    return `Extract all text from this image${langHint}. Only output the text content, preserving the layout as much as possible.`;
  }

  private detectMimeType(buffer: Buffer): string {
    // Check magic bytes
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
    if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
    return 'image/png'; // Default
  }

  private parseResponse(content: string): AnalyzeResult {
    // Simple parsing - extract sections
    const result: AnalyzeResult = { text: '' };

    const ocrMatch = content.match(/## OCR Text\s+([\s\S]*?)(?=##|$)/);
    if (ocrMatch) {
      result.text = ocrMatch[1].trim();
    } else {
      // No sections, use entire content as text
      result.text = content;
    }

    const descMatch = content.match(/## Description\s+([\s\S]*?)(?=##|$)/);
    if (descMatch) {
      result.description = descMatch[1].trim();
    }

    return result;
  }
}

export default new VisionAnthropicPlugin();
export { VisionAnthropicPlugin, type AnalyzeOptions, type AnalyzeResult };
