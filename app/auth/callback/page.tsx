"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supa = supabaseBrowser()
        const { data, error } = await supa.auth.getSession()
        
        if (error) {
          console.error("Auth callback error:", error)
          router.push("/auth?error=callback_failed")
          return
        }

        if (data.session) {
          // User is successfully authenticated
          // Check if they have a survey draft to complete
          const draft = localStorage.getItem("nexo_survey_draft_v1")
          if (draft) {
            // They have a draft, redirect to complete it
            router.push("/survey/complete")
          } else {
            // No draft, go to views
            router.push("/views")
          }
        } else {
          // No session, redirect to auth
          router.push("/auth")
        }
      } catch (error) {
        console.error("Auth callback error:", error)
        router.push("/auth?error=callback_failed")
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Completing sign in...</h1>
        <p className="text-sm text-neutral-600">Please wait while we finish setting up your account.</p>
      </div>
    </div>
  )
}
