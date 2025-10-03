/**
 * Generate username from email address
 */

export function generateUsernameFromEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return 'user'
  }
  
  // Extract the part before @
  const localPart = email.split('@')[0]
  
  // Remove special characters and convert to lowercase
  const cleanLocal = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20) // Limit length
  
  // If empty after cleaning, use 'user'
  if (!cleanLocal) {
    return 'user'
  }
  
  // Add random number to make it unique
  const randomSuffix = Math.floor(Math.random() * 1000)
  
  return `${cleanLocal}${randomSuffix}`
}

/**
 * Check if username is available
 */
export async function isUsernameAvailable(username: string, supabase: any, excludeUserId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('display_name', username)
      .neq('id', excludeUserId || '')
      .single()
    
    if (error && error.code === 'PGRST116') {
      // No rows found - username is available
      return true
    }
    
    if (error) {
      console.error('Username check error:', error)
      return false
    }
    
    // Username exists
    return false
  } catch (error) {
    console.error('Username check error:', error)
    return false
  }
}

/**
 * Generate a unique username from email
 */
export async function generateUniqueUsername(email: string, supabase: any): Promise<string> {
  const baseUsername = generateUsernameFromEmail(email)
  
  // Check if base username is available
  if (await isUsernameAvailable(baseUsername, supabase)) {
    return baseUsername
  }
  
  // Try variations with different numbers
  for (let i = 1; i <= 9999; i++) {
    const username = `${baseUsername}${i}`
    if (await isUsernameAvailable(username, supabase)) {
      return username
    }
  }
  
  // Fallback to timestamp-based username
  const timestamp = Date.now().toString().slice(-6)
  return `${baseUsername}${timestamp}`
}
