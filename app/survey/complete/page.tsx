"use client"
import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import { loadDraft, clearDraft } from "@/src/lib/survey/storage"

function SurveyCompletePageInner() {
  const [status, setStatus] = useState<"idle"|"submitting"|"done"|"error">("idle")
  const [msg, setMsg] = useState("")
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      setStatus("submitting")
      try {
        const draft = loadDraft()
        if (!draft) {
          // No draft found, redirect to survey
          router.replace("/survey")
          return
        }

        const supa = supabaseBrowser()
        const { data: session } = await supa.auth.getSession()
        const token = session.session?.access_token
        if (!token) {
          // Not signed in, redirect to auth
          router.replace(`/auth?next=${encodeURIComponent("/survey/complete")}`)
          return
        }

        // Submit the survey
        const res = await fetch("/api/survey/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ answers: draft })
        })
        
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || "Failed to submit survey")
        }

        // Clear the draft and redirect to results
        clearDraft()
        setStatus("done")
        
        // Small delay to ensure data is processed, then redirect
        setTimeout(() => {
          router.replace("/views")
        }, 1000)
      } catch (e: any) {
        setStatus("error")
        setMsg(e.message || "Something went wrong.")
      }
    }
    run()
  }, [router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <main className="w-full max-w-sm text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-semibold mb-2">Almost Done!</h1>
        </div>

        <div className="space-y-4">
          {status === "submitting" && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                Submitting your answers and building your political profile...
              </p>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div className="bg-black h-2 rounded-full animate-pulse" style={{ width: "60%" }}></div>
              </div>
            </div>
          )}

          {status === "done" && (
            <div className="space-y-3">
              <p className="text-sm text-green-600 font-medium">
                ✓ Survey completed successfully!
              </p>
              <p className="text-sm text-neutral-600">
                Redirecting to your results...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-red-600">
                We hit a snag: {msg}
              </p>
              <div className="space-y-2">
                <button 
                  className="w-full h-11 rounded-lg bg-black px-4 text-white" 
                  onClick={() => router.push("/survey")}
                >
                  Retry Survey
                </button>
                <button 
                  className="w-full h-11 rounded-lg border border-neutral-300 px-4 text-neutral-700" 
                  onClick={() => router.push("/views")}
                >
                  Go to Results
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function SurveyCompletePage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-md p-4">
        <h1 className="mb-2 text-xl font-semibold">Loading...</h1>
      </main>
    }>
      <SurveyCompletePageInner />
    </Suspense>
  )
}
