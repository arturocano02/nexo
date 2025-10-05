/**
 * Environment variable helpers with safe server-side access
 * Returns descriptive errors if required vars are missing
 */

// Custom error class for environment issues
export class EnvError extends Error {
  constructor(public varName: string, message: string) {
    super(message)
    this.name = 'EnvError'
  }
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL is not configured')
  }
  return url
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new EnvError('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')
  }
  return key
}

// Helper to get Supabase config as an object
export function getSupabaseConfig() {
  return {
    url: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey()
  }
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return key
}

export function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY || null
}

export function requireOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return key
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

// Client-side safe checks
export function getClientSupabaseUrl(): string {
  if (typeof window === 'undefined') {
    throw new Error('getClientSupabaseUrl called on server')
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }
  return url
}

export function getClientSupabaseAnonKey(): string {
  if (typeof window === 'undefined') {
    throw new Error('getClientSupabaseAnonKey called on server')
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured')
  }
  return key
}

// Helper to check if in development mode
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

// Helper to create standard 503 response for missing env
export function createMissingEnvResponse(varName: string) {
  return {
    error: `Server configuration error: ${varName} is not set`,
    code: 'MISSING_ENV_VAR',
    varName
  }
}

// Helper to create env error response for API routes
export function createEnvErrorResponse(error: EnvError) {
  return {
    error: `Server configuration error: ${error.varName} is not set`,
    code: 'MISSING_ENV_VAR',
    varName: error.varName
  }
}

// Helper to assert all server env vars are present
export function assertServerEnv() {
  getSupabaseUrl()
  getSupabaseAnonKey()
  // OpenAI key is optional, so we don't assert it here
}
