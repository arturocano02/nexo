"use client"
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"

function AuthPageInner() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/views"

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
        router.replace(next)
      }
    })

    return () => subscription.unsubscribe()
  }, [router, next])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const supa = supabaseBrowser()
      
      if (isSignUp) {
        const { error } = await supa.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setMessage("Check your email for the confirmation link!")
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
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-2 text-xl font-semibold">
        {isSignUp ? "Create Account" : "Sign In"}
      </h1>
      <p className="mb-6 text-sm text-neutral-600">
        {isSignUp 
          ? "Sign up to save your survey results and build your political profile."
          : "Sign in to access your political views and continue where you left off."
        }
      </p>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
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
          />
        </div>

        {message && (
          <div className={`text-sm ${message.includes("error") || message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-lg bg-black text-white disabled:opacity-50"
        >
          {loading ? "Loading..." : (isSignUp ? "Create Account" : "Sign In")}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-neutral-600 underline"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </main>
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
