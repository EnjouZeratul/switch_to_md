/**
 * Cache implementation for switch_to_md
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface CacheEntry {
  content: string;
  metadata: {
    source: string;
    type: string;
    timestamp: number;
  };
}

const DEFAULT_CACHE_DIR = '.switch-to-md-cache';
const DEFAULT_TTL = 86400; // 24 hours in seconds

let cacheDir: string = join(process.cwd(), DEFAULT_CACHE_DIR);
let cacheEnabled: boolean = false;
let cacheTTL: number = DEFAULT_TTL;

/**
 * Configure cache settings
 */
export function configureCache(options: {
  enabled?: boolean;
  dir?: string;
  ttl?: number;
}): void {
  if (options.enabled !== undefined) {
    cacheEnabled = options.enabled;
  }
  if (options.dir) {
    cacheDir = options.dir;
  }
  if (options.ttl) {
    cacheTTL = options.ttl;
  }

  // Ensure cache directory exists
  if (cacheEnabled && !existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Generate cache key from file content and config
 */
export function generateCacheKey(
  filePath: string,
  content: Buffer,
  configHash?: string
): string {
  const hash = createHash('sha256');
  hash.update(filePath);
  hash.update(content);
  if (configHash) {
    hash.update(configHash);
  }
  return hash.digest('hex').slice(0, 32);
}

/**
 * Get cached result
 */
export function getCached(key: string): CacheEntry | null {
  if (!cacheEnabled) {
    return null;
  }

  const cachePath = join(cacheDir, `${key}.json`);

  try {
    if (!existsSync(cachePath)) {
      return null;
    }

    // Check TTL
    const stats = statSync(cachePath);
    const age = (Date.now() - stats.mtimeMs) / 1000;
    if (age > cacheTTL) {
      // Cache expired
      try {
        unlinkSync(cachePath);
      } catch {}
      return null;
    }

    const data = readFileSync(cachePath, 'utf-8');
    return JSON.parse(data) as CacheEntry;
  } catch {
    return null;
  }
}

/**
 * Set cached result
 */
export function setCached(key: string, entry: CacheEntry): void {
  if (!cacheEnabled) {
    return;
  }

  // Ensure cache directory exists
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const cachePath = join(cacheDir, `${key}.json`);

  try {
    writeFileSync(cachePath, JSON.stringify(entry), 'utf-8');
  } catch {
    // Cache write failed, ignore
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  if (!existsSync(cacheDir)) {
    return;
  }

  const fs = require('fs');
  const files = fs.readdirSync(cacheDir);

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        unlinkSync(join(cacheDir, file));
      } catch {}
    }
  }
}

/**
 * Check if cache is enabled
 */
export function isCacheEnabled(): boolean {
  return cacheEnabled;
}

/**
 * Get cache directory
 */
export function getCacheDir(): string {
  return cacheDir;
}
