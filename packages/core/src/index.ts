/**
 * switch_to_md - Convert any file format to Markdown
 */

// Main API
export { convert, type ConvertOptions, type BatchResult, type ProgressInfo } from './convert';
export { configure, defineConfig } from './config';
export type { Config, VisionConfig, AudioConfig } from './types';

// Error types
export {
  SwitchToMdError,
  UnsupportedFormatError,
  VisionNotConfiguredError,
  AudioNotConfiguredError,
  FileNotFoundError,
  ApiKeyInvalidError,
  CorruptedFileError,
  FileTooLargeError,
  AbortError,
  sanitizeError,
  type CorruptedWarning
} from './errors';

// Types
export { type FileInfo, type FileType, type ConvertResult } from './types';

// Utilities (optional use)
export { detectFileType, type DetectResult } from './detect';
export { getSupportedFormats } from './router';
