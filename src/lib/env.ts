/**
 * Centralized environment variable access with proper validation
 */

export interface EnvConfig {
  OPENAI_API_KEY: string | null
  NEXT_PUBLIC_SUPABASE_URL: string | null
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string | null
  NODE_ENV: 'development' | 'production' | 'test'
}

export class EnvError extends Error {
  constructor(message: string, public readonly key: string) {
    super(message)
    this.name = 'EnvError'
  }
}

function getEnvVar(key: string): string | null {
  if (typeof window !== 'undefined') {
    // Client-side: only access NEXT_PUBLIC_ vars
    if (!key.startsWith('NEXT_PUBLIC_')) {
      return null
    }
  }
  return process.env[key] || null
}

export function getEnvConfig(): EnvConfig {
  return {
    OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY'),
    NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development'
  }
}

export function getOpenAIKey(): string | null {
  return getEnvVar('OPENAI_API_KEY')
}

export function getSupabaseConfig() {
  const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  
  if (!url || !anonKey) {
    throw new EnvError('Missing Supabase configuration', 'SUPABASE_CONFIG')
  }
  
  return { url, anonKey }
}

/**
 * Server-side environment assertion
 * Throws typed errors for missing required keys
 */
export function assertServerEnv(): void {
  const config = getEnvConfig()
  
  if (!config.OPENAI_API_KEY) {
    throw new EnvError('OpenAI API key is required for AI analysis', 'OPENAI_API_KEY')
  }
  
  if (!config.NEXT_PUBLIC_SUPABASE_URL) {
    throw new EnvError('Supabase URL is required', 'NEXT_PUBLIC_SUPABASE_URL')
  }
  
  if (!config.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new EnvError('Supabase anon key is required', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
}

/**
 * Check if OpenAI is configured (for UI banners)
 */
export function isOpenAIConfigured(): boolean {
  return getOpenAIKey() !== null
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return getEnvConfig().NODE_ENV === 'development'
}

/**
 * Create a friendly error response for missing env vars
 */
export function createEnvErrorResponse(error: EnvError) {
  return {
    error: `Configuration error: ${error.message}`,
    code: 'MISSING_CONFIG',
    key: error.key
  }
}

