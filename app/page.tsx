"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { loadDraft } from "@/src/lib/survey/storage"
import { supabaseBrowser } from "@/src/lib/supabase/client"

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUserState = async () => {
      try {
        const supa = supabaseBrowser()
        const { data: { session } } = await supa.auth.getSession()
        
        if (session) {
          // User is signed in, check if they have a draft
          const draft = loadDraft()
          if (draft) {
            // They have a saved draft, redirect to complete it
            router.replace("/survey/complete")
            return
          } else {
            // No draft, go to views
            router.replace("/views")
            return
          }
        } else {
          // Not signed in, check if they have a draft
          const draft = loadDraft()
          if (draft) {
            // They have a saved draft but aren't signed in, redirect to complete
            router.replace("/survey/complete")
            return
          }
        }
      } catch (error) {
        console.error("Error checking user state:", error)
      } finally {
        setLoading(false)
      }
    }

    checkUserState()
  }, [router])

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <h1 className="mb-2 text-2xl font-semibold">Nexo</h1>
        <p className="text-neutral-600">Loading...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-2 text-2xl font-semibold">Nexo</h1>
      <p className="text-neutral-600">Your views. Your voice. Our party.</p>
      <div className="mt-6">
        <a href="/survey" className="inline-block rounded-lg bg-black px-4 py-2 text-white">Start</a>
      </div>
    </main>
  )
}
