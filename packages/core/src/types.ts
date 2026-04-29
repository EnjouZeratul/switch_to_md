/**
 * Type definitions for switch_to_md
 */

// ===== File Types =====
export type FileType =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'epub'
  | 'txt'
  | 'html'
  | 'svg'
  | 'image'
  | 'audio'
  | 'code'
  | 'unknown';

export interface FileInfo {
  type: FileType;
  mime: string;
  ext: string;
  needsVision: boolean;
  needsAudio: boolean;
}

// ===== Convert Options =====
export interface ConvertOptions {
  /** Output file path (single file) */
  output?: string;
  /** Output directory (batch) */
  outputDir?: string;
  /** Image handling */
  images?: ImageOptions;
  /** Progress callback */
  onProgress?: (info: ProgressInfo) => void;
  /** Cache settings */
  cache?: boolean | CacheOptions;
  /** Abort signal */
  signal?: AbortSignal;
}

export interface ImageOptions {
  /** How to embed images */
  embed: 'base64' | 'file' | 'link' | 'none';
  /** Directory for extracted images (embed: 'file') */
  outputDir?: string;
  /** Max width in pixels (resize) */
  maxWidth?: number;
}

export interface CacheOptions {
  enabled: boolean;
  dir?: string;
  ttl?: number; // seconds
}

export interface ProgressInfo {
  percent: number;
  stage: string;
  message?: string;
}

// ===== Convert Result =====
export interface ConvertResult {
  content: string;
  source: string;
  type: FileType;
  warnings?: CorruptedWarning[];
}

export interface CorruptedWarning {
  type: 'corrupted_page' | 'missing_image' | 'encoding_error';
  location: string;
  message: string;
}

// ===== Batch Result =====
export interface BatchResult {
  files: Record<string, string>;
  errors: Record<string, Error>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

// ===== Configuration Types =====
export interface Config {
  /** Quick config - provider */
  provider?: 'openai' | 'anthropic' | 'google' | 'aliyun' | 'local';
  /** Quick config - API key */
  apiKey?: string;
  /** Vision module config */
  vision?: VisionConfig;
  /** Audio module config */
  audio?: AudioConfig;
  /** Default language(s) */
  lang?: string | string[];
  /** Default timeout in ms */
  timeout?: number;
}

export interface VisionConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'aliyun' | 'local' | 'custom';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  /** Local model specific */
  lang?: string[];
  /** Custom provider specific */
  headers?: Record<string, string>;
}

export interface AudioConfig {
  provider: 'openai' | 'local' | 'custom';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  /** Local model specific */
  lang?: string;
  /** Custom provider specific */
  headers?: Record<string, string>;
}

// ===== Plugin Interface =====
export interface VisionPlugin {
  name: string;
  analyze(buffer: Buffer, options?: any): Promise<{ text: string; description?: string }>;
}

export interface AudioPlugin {
  name: string;
  transcribe(buffer: Buffer, options?: any): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string }> }>;
}
