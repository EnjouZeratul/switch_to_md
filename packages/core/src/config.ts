/**
 * Configuration management for switch_to_md
 */

import type { Config, VisionConfig, AudioConfig } from './types';

// Global config store
let globalConfig: Config = {};

// Environment variable mapping
const ENV_MAPPING = {
  provider: 'SWITCH_TO_MD_PROVIDER',
  apiKey: 'SWITCH_TO_MD_API_KEY',
  lang: 'SWITCH_TO_MD_LANG',
  timeout: 'SWITCH_TO_MD_TIMEOUT',
  vision: {
    provider: 'SWITCH_TO_MD_VISION_PROVIDER',
    apiKey: 'SWITCH_TO_MD_VISION_API_KEY',
    model: 'SWITCH_TO_MD_VISION_MODEL',
    baseUrl: 'SWITCH_TO_MD_VISION_BASE_URL',
  },
  audio: {
    provider: 'SWITCH_TO_MD_AUDIO_PROVIDER',
    apiKey: 'SWITCH_TO_MD_AUDIO_API_KEY',
    model: 'SWITCH_TO_MD_AUDIO_MODEL',
    baseUrl: 'SWITCH_TO_MD_AUDIO_BASE_URL',
  },
} as const;

/**
 * Configure switch_to_md
 */
export function configure(config: Config): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Define config for config files (provides type safety)
 */
export function defineConfig(config: Config): Config {
  return config;
}

/**
 * Get current configuration (merged with env vars)
 */
export function getConfig(): Config {
  return {
    ...getConfigFromEnv(),
    ...globalConfig,
  };
}

/**
 * Get vision configuration
 */
export function getVisionConfig(): VisionConfig | undefined {
  const config = getConfig();

  // Check if vision is explicitly configured
  if (config.vision) {
    return config.vision;
  }

  // Fall back to global config
  if (config.provider && config.apiKey) {
    return {
      provider: config.provider as VisionConfig['provider'],
      apiKey: config.apiKey,
      model: config.provider === 'openai' ? 'gpt-4o' : undefined,
    };
  }

  return undefined;
}

/**
 * Get audio configuration
 */
export function getAudioConfig(): AudioConfig | undefined {
  const config = getConfig();

  // Check if audio is explicitly configured
  if (config.audio) {
    return config.audio;
  }

  // Fall back to global config
  if (config.provider && config.apiKey) {
    return {
      provider: config.provider as AudioConfig['provider'],
      apiKey: config.apiKey,
    };
  }

  return undefined;
}

/**
 * Read configuration from environment variables
 */
function getConfigFromEnv(): Config {
  const config: Config = {};

  // Global config from env
  if (process.env[ENV_MAPPING.provider]) {
    config.provider = process.env[ENV_MAPPING.provider] as Config['provider'];
  }

  if (process.env[ENV_MAPPING.apiKey]) {
    config.apiKey = process.env[ENV_MAPPING.apiKey];
  }

  if (process.env[ENV_MAPPING.lang]) {
    config.lang = process.env[ENV_MAPPING.lang]!.split(',');
  }

  if (process.env[ENV_MAPPING.timeout]) {
    config.timeout = parseInt(process.env[ENV_MAPPING.timeout]!, 10);
  }

  // Vision config from env
  const visionConfig = getModuleConfigFromEnv('vision');
  if (visionConfig) {
    config.vision = visionConfig;
  }

  // Audio config from env
  const audioConfig = getModuleConfigFromEnv('audio');
  if (audioConfig) {
    config.audio = audioConfig;
  }

  return config;
}

function getModuleConfigFromEnv(module: 'vision' | 'audio'): VisionConfig | AudioConfig | undefined {
  const mapping = ENV_MAPPING[module];
  const env = process.env;

  if (!env[mapping.provider] && !env[mapping.apiKey] && !env[mapping.baseUrl]) {
    return undefined;
  }

  const config: VisionConfig | AudioConfig = {
    provider: (env[mapping.provider] || 'openai') as any,
  };

  if (env[mapping.apiKey]) {
    config.apiKey = env[mapping.apiKey];
  }

  if (env[mapping.model]) {
    config.model = env[mapping.model];
  }

  if (env[mapping.baseUrl]) {
    config.baseUrl = env[mapping.baseUrl];
  }

  return config;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  globalConfig = {};
}
