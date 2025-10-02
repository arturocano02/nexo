"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { loadDraft } from "@/src/lib/survey/storage"
import { supabaseBrowser } from "@/src/lib/supabase/client"

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [userState, setUserState] = useState<"loading" | "new" | "returning" | "has-draft">("loading")
  const router = useRouter()

  useEffect(() => {
    const checkUserState = async () => {
      try {
        const supa = supabaseBrowser()
        const { data: { session } } = await supa.auth.getSession()
        
        if (session) {
          // User is signed in, show them as a returning user
          setUserState("returning")
        } else {
          // Not signed in, check if they have a draft
          const draft = loadDraft()
          if (draft) {
            setUserState("has-draft")
          } else {
            setUserState("new")
          }
        }
      } catch (error) {
        console.error("Error checking user state:", error)
        setUserState("new")
      } finally {
        setLoading(false)
      }
    }

    checkUserState()
  }, [router])

  const handleNewUser = () => {
    router.push("/survey")
  }

  const handleReturningUser = () => {
    router.push("/views")
  }

  const handleContinueDraft = () => {
    router.push("/survey/complete")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-semibold">Nexo</h1>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <main className="w-full max-w-sm text-center">
        <div className="mb-8">
          <h1 className="mb-3 text-3xl font-bold text-black">Nexo</h1>
          <p className="text-lg text-neutral-600 mb-2">Your views. Your voice. Our party.</p>
        </div>

            {userState === "returning" ? (
              <div className="mb-6">
                <button
                  onClick={() => router.push("/survey")}
                  className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  Retake Political Profile Quiz
                </button>
              </div>
            ) : (
              <div className="mb-8 space-y-4">
                <div className="p-4 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-2xl border border-neutral-200">
                  <h2 className="text-lg font-semibold text-black mb-2">Discover Your Political Profile</h2>
                  <p className="text-sm text-neutral-700 leading-relaxed">
                    Take our 5-question political assessment to see where you fit in UK politics. 
                    Get your personalized profile and compare with others.
                  </p>
                </div>

                <div className="space-y-3 text-sm text-neutral-600">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600">✓</span>
                    <span>5 thoughtful questions, not 50</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-600">✓</span>
                    <span>See where you fit in UK politics</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-600">✓</span>
                    <span>Compare with party members</span>
                  </div>
                </div>
              </div>
            )}

        {userState === "has-draft" && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Continue Your Assessment</h3>
            <p className="text-xs text-blue-700 mb-3">You have a saved survey draft. Complete it to see your results.</p>
            <button
              onClick={handleContinueDraft}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              Continue Assessment
            </button>
          </div>
        )}

        <div className="space-y-3">
          {userState === "returning" ? (
            <>
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl">
                <h3 className="text-sm font-semibold text-green-900 mb-1">Welcome Back!</h3>
                <p className="text-xs text-green-700">You're signed in. Access your political profile and continue where you left off.</p>
              </div>
              <button
                onClick={handleReturningUser}
                className="w-full rounded-2xl bg-black px-6 py-4 text-white font-semibold text-lg hover:bg-neutral-800 transition-colors"
              >
                View My Profile
              </button>
              <p className="text-xs text-neutral-500">
                Access your saved political profile and results
              </p>
            </>
          ) : (
            <>
              <button
                onClick={handleNewUser}
                className="w-full rounded-2xl bg-black px-6 py-4 text-white font-semibold text-lg hover:bg-neutral-800 transition-colors"
              >
                I'm New Here
              </button>
              <p className="text-xs text-neutral-500 mb-4">
                Take the quiz first, then sign up to save your results
              </p>

              <button
                onClick={() => router.push("/auth")}
                className="w-full rounded-2xl border-2 border-neutral-300 px-6 py-4 text-neutral-700 font-semibold text-lg hover:bg-neutral-50 transition-colors"
              >
                I'm a Member
              </button>
              <p className="text-xs text-neutral-500">
                Sign in to access your saved political profile
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

