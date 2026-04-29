/**
 * Error types for switch_to_md
 */

/** Base error class */
export class SwitchToMdError extends Error {
  code: string;
  hint?: string;

  constructor(message: string, code: string, hint?: string) {
    super(message);
    this.name = 'SwitchToMdError';
    this.code = code;
    this.hint = hint;
  }
}

/** Unsupported file format */
export class UnsupportedFormatError extends SwitchToMdError {
  format: string;
  supported: string[];

  constructor(format: string, supported: string[]) {
    super(
      `Unsupported format: .${format}`,
      'UNSUPPORTED_FORMAT',
      `Supported formats: ${supported.join(', ')}`
    );
    this.name = 'UnsupportedFormatError';
    this.format = format;
    this.supported = supported;
  }
}

/** Vision backend not configured */
export class VisionNotConfiguredError extends SwitchToMdError {
  constructor() {
    super(
      'Vision backend not configured for image processing',
      'VISION_NOT_CONFIGURED',
      `
[switch-to-md] 图片处理需要配置视觉后端

请选择以下方式之一：

方式1：使用 OpenAI（推荐，快速）
  configure({ provider: 'openai', apiKey: 'sk-xxx' });
  或设置环境变量：SWITCH_TO_MD_API_KEY=sk-xxx

方式2：使用本地模型（免费）
  npm i @switch-to-md/vision-local

方式3：自定义服务
  configure({ vision: { provider: 'custom', baseUrl: '...' } });

文档：https://github.com/xxx/switch_to_md#setup
`.trim()
    );
    this.name = 'VisionNotConfiguredError';
  }
}

/** Audio backend not configured */
export class AudioNotConfiguredError extends SwitchToMdError {
  constructor() {
    super(
      'Audio backend not configured for transcription',
      'AUDIO_NOT_CONFIGURED',
      `
[switch-to-md] 音频处理需要配置音频后端

请选择以下方式之一：

方式1：使用 OpenAI Whisper
  configure({ audio: { provider: 'openai', apiKey: 'sk-xxx' } });

方式2：使用本地 Whisper
  npm i @switch-to-md/audio-local

文档：https://github.com/xxx/switch_to_md#setup
`.trim()
    );
    this.name = 'AudioNotConfiguredError';
  }
}

/** File not found */
export class FileNotFoundError extends SwitchToMdError {
  path: string;

  constructor(path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND');
    this.name = 'FileNotFoundError';
    this.path = path;
  }
}

/** API Key invalid */
export class ApiKeyInvalidError extends SwitchToMdError {
  provider: string;

  constructor(provider: string) {
    super(`Invalid API key for ${provider}`, 'API_KEY_INVALID');
    this.name = 'ApiKeyInvalidError';
    this.provider = provider;
  }
}

/** Corrupted file */
export class CorruptedFileError extends SwitchToMdError {
  warnings: CorruptedWarning[];

  constructor(warnings: CorruptedWarning[]) {
    super('File is partially corrupted', 'CORRUPTED_FILE');
    this.name = 'CorruptedFileError';
    this.warnings = warnings;
  }
}

/** File too large */
export class FileTooLargeError extends SwitchToMdError {
  size: number;
  maxSize: number;

  constructor(size: number, maxSize: number) {
    super(
      `File too large: ${formatBytes(size)} (max: ${formatBytes(maxSize)})`,
      'FILE_TOO_LARGE',
      'Use the maxFileSize option to increase the limit, or process a smaller file.'
    );
    this.name = 'FileTooLargeError';
    this.size = size;
    this.maxSize = maxSize;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Abort error for cancellation */
export class AbortError extends Error {
  constructor(message: string = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/** Sanitize sensitive information from error messages */
export function sanitizeError(error: Error): Error {
  let message = error.message;

  // Redact OpenAI API keys (sk-...)
  message = message.replace(/sk-[a-zA-Z0-9]{20,}/g, '***REDACTED-OPENAI-KEY***');

  // Redact Anthropic API keys (sk-ant-...)
  message = message.replace(/sk-ant-[a-zA-Z0-9_-]+/gi, '***REDACTED-ANTHROPIC-KEY***');

  // Redact generic API keys in common formats
  message = message.replace(/(['"']?(?:api[_-]?key|apikey|key)['"']?\s*[:=]\s*)['"'][a-zA-Z0-9_-]{16,}['"']/gi, '$1***REDACTED***');

  if (message === error.message) {
    return error;
  }

  const sanitized = new Error(message);
  sanitized.name = error.name;
  sanitized.stack = error.stack;
  (sanitized as Error & { cause?: unknown }).cause = (error as Error & { cause?: unknown }).cause;
  return sanitized;
}

export interface CorruptedWarning {
  type: 'corrupted_page' | 'missing_image' | 'encoding_error';
  location: string;
  message: string;
}
