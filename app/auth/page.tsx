"use client"
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import { generateUniqueUsername } from "@/src/lib/utils/username"
import Link from "next/link"

function AuthPageInner() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [checkingAccount, setCheckingAccount] = useState(false)
  const [accountExists, setAccountExists] = useState<boolean | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/views"
  const error = searchParams.get("error")

  useEffect(() => {
    const checkSession = async () => {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      if (session) {
        router.replace(next)
      }
    }
    checkSession()

    // Listen for auth state changes (including email confirmation)
    const { data: { subscription } } = supabaseBrowser().auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // User just signed in (including after email confirmation)
        // Check if they have a survey draft to complete
        const draft = localStorage.getItem("nexo_survey_draft_v1")
        if (draft) {
          // They have a draft, redirect to complete it
          router.replace("/survey/complete")
        } else {
          // No draft, go to the next page
          router.replace(next)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router, next])

  useEffect(() => {
    if (error === "callback_failed") {
      setMessage("There was an issue completing your sign in. Please try again.")
    }
    
    // Check if user has already accepted terms
    const termsAccepted = localStorage.getItem("nexo_terms_accepted")
    if (termsAccepted === "true") {
      setAcceptedTerms(true)
    }
  }, [error])

  const checkAccountExists = async (email: string) => {
    if (!email || !email.includes('@')) return
    
    setCheckingAccount(true)
    try {
      const response = await fetch('/api/auth/check-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setAccountExists(data.exists)
      } else {
        console.error('Account check error:', data.error)
        setAccountExists(null)
      }
    } catch (error) {
      console.error('Account check error:', error)
      setAccountExists(null)
    } finally {
      setCheckingAccount(false)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)
    setAccountExists(null)
    
    // Check if account exists after a short delay
    if (newEmail && newEmail.includes('@')) {
      const timeoutId = setTimeout(() => {
        checkAccountExists(newEmail)
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    // Check terms acceptance for signup
    if (isSignUp && !acceptedTerms) {
      setMessage("You must accept the Terms and Conditions to create an account.")
      setLoading(false)
      return
    }

    try {
      const supa = supabaseBrowser()
      
      if (isSignUp) {
        const { data: signupData, error } = await supa.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        
        // Create user profile with generated username
        if (signupData.user) {
          try {
            // Generate a simple username from email without checking uniqueness
            // We'll just use the part before @ and add a random number
            const localPart = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)
            const randomSuffix = Math.floor(Math.random() * 1000)
            const username = `${localPart}${randomSuffix}`
            
            console.log(`Creating profile for user ${signupData.user.id} with username ${username}`)
            
            const { error: profileError } = await supa
              .from('profiles')
              .insert({
                id: signupData.user.id,
                display_name: username
              })
            
            if (profileError) {
              console.error('Profile creation error:', profileError)
              // Don't throw - profile can be created later
            } else {
              console.log(`Profile created successfully for ${username}`)
            }
          } catch (profileError) {
            console.error('Profile creation error:', profileError)
            // Don't throw - profile can be created later
          }
        }
        
        // Save terms acceptance in localStorage
        localStorage.setItem("nexo_terms_accepted", "true")
        
        // Show detailed confirmation message
        setMessage("Account created! Please check your email for the confirmation link. You need to click this link to verify your account before signing in.")
      } else {
        const { error } = await supa.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.replace(next)
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <main className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold text-black">Nexo</h1>
          <p className="text-lg text-neutral-600 mb-2">Your views. Your voice. Our party.</p>
        </div>

        {/* Mode Toggle */}
        <div className="mb-6">
          <div className="flex bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isSignUp 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isSignUp 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">
              {isSignUp ? "Create Your Account" : "Welcome Back"}
            </h2>
            <p className="text-sm text-neutral-600">
              {isSignUp 
                ? "Join Nexo to discover your political profile and engage in meaningful discussions."
                : "Sign in to access your political profile and continue your journey."
              }
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm pr-10"
                  placeholder="your@email.com"
                />
                {checkingAccount && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-neutral-300 border-t-black rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              
              {/* Account Status Indicator */}
              {accountExists !== null && email && (
                <div className="mt-2 text-xs">
                  {accountExists ? (
                    <div className="flex items-center text-blue-600">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Account exists - please sign in instead
                    </div>
                  ) : (
                    <div className="flex items-center text-green-600">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      New account - you can sign up
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="••••••••"
                minLength={6}
              />
              {isSignUp && (
                <p className="mt-1 text-xs text-neutral-500">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>

            {/* Terms and Conditions for Sign Up */}
            {isSignUp && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="accept-terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="accept-terms" className="text-sm text-neutral-700">
                    I agree to the{" "}
                    <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline">
                      Terms and Conditions
                    </Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                {!acceptedTerms && (
                  <p className="text-xs text-red-600">
                    You must accept the terms to create an account
                  </p>
                )}
              </div>
            )}

            {message && (
              <div className={`text-sm p-3 rounded-lg ${
                message.includes("error") || message.includes("Error") 
                  ? "text-red-600 bg-red-50 border border-red-200" 
                  : "text-green-600 bg-green-50 border border-green-200"
              }`}>
                {message.includes("confirmation link") ? (
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <strong>Check your email!</strong>
                    </div>
                    <p>{message}</p>
                  </div>
                ) : (
                  message
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isSignUp && !acceptedTerms)}
              className={`h-11 w-full rounded-lg text-white font-medium transition-colors ${
                loading || (isSignUp && !acceptedTerms)
                  ? 'bg-neutral-400 cursor-not-allowed'
                  : 'bg-black hover:bg-neutral-800'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </div>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </button>
          </form>

          {/* Additional Help Text */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-neutral-500">
              {isSignUp 
                ? "Already have an account? Click 'Sign In' above."
                : "Don't have an account? Click 'Sign Up' above."
              }
            </p>
            
            {/* Account Status Help */}
            {accountExists !== null && email && (
              <div className="text-xs text-neutral-500">
                {accountExists ? (
                  <p>This email is already registered. Please sign in with your password.</p>
                ) : (
                  <p>This email is not registered. You can create a new account.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-md p-4">
        <h1 className="mb-2 text-xl font-semibold">Loading...</h1>
      </main>
    }>
      <AuthPageInner />
    </Suspense>
  )
}
