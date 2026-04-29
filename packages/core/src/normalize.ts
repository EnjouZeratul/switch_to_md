/**
 * Markdown normalization
 */

import type { FileType, ConvertResult, CorruptedWarning } from './types';

export interface NormalizedOutput {
  content: string;
  frontmatter: Record<string, any>;
  warnings?: CorruptedWarning[];
}

/**
 * Normalize output to unified Markdown format
 */
export function normalize(
  rawContent: string,
  source: string,
  type: FileType,
  options?: {
    pages?: number;
    backend?: string;
    extractedAt?: string;
    warnings?: CorruptedWarning[];
  }
): NormalizedOutput {
  const frontmatter: Record<string, any> = {
    source,
    type: type.toUpperCase(),
    extracted_at: options?.extractedAt || new Date().toISOString(),
  };

  if (options?.pages) {
    frontmatter.pages = options.pages;
  }

  if (options?.backend) {
    frontmatter.backend = options.backend;
  }

  // Generate frontmatter string
  const frontmatterStr = generateFrontmatter(frontmatter);

  // Combine frontmatter with content
  const content = `${frontmatterStr}\n\n${rawContent}`;

  return {
    content,
    frontmatter,
    warnings: options?.warnings,
  };
}

/**
 * Generate YAML frontmatter
 */
function generateFrontmatter(data: Record<string, any>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      lines.push(`${key}: ${formatValue(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Format value for YAML
 */
function formatValue(value: any): string {
  if (typeof value === 'string') {
    // Use JSON.stringify for proper escaping - JSON strings are valid YAML
    if (/^[a-zA-Z0-9_\-./:@]+$/.test(value)) {
      return value;
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`;
  }
  if (typeof value === 'object') {
    // Handle nested objects by converting to JSON
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Extract title from content
 */
export function extractTitle(content: string, fallback: string): string {
  // Try to find first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1];
  }

  // Use filename as fallback
  return fallback;
}

/**
 * Ensure proper heading hierarchy
 */
export function fixHeadingHierarchy(content: string): string {
  // This is a placeholder - in real implementation we would
  // analyze and fix heading levels
  return content;
}

/**
 * Format tables properly
 */
export function formatTables(content: string): string {
  // Ensure table rows have consistent column counts
  // This is a placeholder
  return content;
}