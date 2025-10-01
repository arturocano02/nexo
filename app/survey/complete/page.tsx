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
        router.replace("/views")
      } catch (e: any) {
        setStatus("error")
        setMsg(e.message || "Something went wrong.")
      }
    }
    run()
  }, [router])

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-2 text-xl font-semibold">Completing your survey...</h1>
      <p className="text-sm text-neutral-600">
        {status === "submitting" && "Submitting your answers and building your political profile..."}
        {status === "done" && "Redirecting to your results..."}
        {status === "error" && `We hit a snag: ${msg}`}
      </p>
      {status === "error" && (
        <div className="mt-4 space-y-2">
          <button 
            className="h-11 rounded-lg bg-black px-4 text-white" 
            onClick={() => router.push("/survey")}
          >
            Back to survey
          </button>
          <button 
            className="h-11 rounded-lg border border-neutral-300 px-4 text-neutral-700" 
            onClick={() => router.push("/views")}
          >
            Go to results
          </button>
        </div>
      )}
    </main>
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
