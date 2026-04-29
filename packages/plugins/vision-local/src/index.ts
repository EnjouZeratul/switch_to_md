/**
 * Local vision plugin using Tesseract.js
 */

import { createWorker, type Worker } from 'tesseract.js';

interface AnalyzeOptions {
  lang?: string[];
  depth?: 'ocr' | 'visual-semantic';
}

interface AnalyzeResult {
  text: string;
  description?: string;
}

class VisionLocalPlugin {
  name = 'vision-local';
  private workers: Map<string, Worker> = new Map();

  async analyze(buffer: Buffer, options?: AnalyzeOptions): Promise<AnalyzeResult> {
    const langs = options?.lang || ['eng'];
    const langKey = langs.sort().join('+');

    // Get or create worker for this language
    const worker = await this.getWorker(langKey, langs);

    // Perform OCR
    const result = await worker.recognize(buffer);

    // Extract text
    const text = result.data.text;

    // For visual-semantic mode, we'd need additional model integration
    // Currently Tesseract.js only provides OCR
    let description: string | undefined;
    if (options?.depth === 'visual-semantic') {
      description = '[Note: Local vision plugin only provides OCR. For visual-semantic analysis, use cloud provider or install additional models.]';
    }

    return {
      text,
      description,
    };
  }

  private async getWorker(key: string, langs: string[]): Promise<Worker> {
    if (this.workers.has(key)) {
      return this.workers.get(key)!;
    }

    const worker = await createWorker(langs.join('+'), 1, {
      logger: (m) => {
        if (m.status === 'loading language traineddata') {
          // Could emit progress here
        }
      },
    });

    this.workers.set(key, worker);
    return worker;
  }

  async terminate(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.terminate();
    }
    this.workers.clear();
  }
}

// Export singleton instance
export default new VisionLocalPlugin();
export { VisionLocalPlugin, type AnalyzeOptions, type AnalyzeResult };
