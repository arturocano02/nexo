"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import { loadDraft, clearDraft } from "@/src/lib/survey/storage"

export default function SurveyFinishPage() {
  const [status, setStatus] = useState<"idle"|"submitting"|"done"|"error">("idle")
  const [msg, setMsg] = useState("")
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      setStatus("submitting")
      try {
        const draft = loadDraft()
        if (!draft) throw new Error("No survey draft found. Please complete the survey first.")

        const supa = supabaseBrowser()
        const { data: session } = await supa.auth.getSession()
        const token = session.session?.access_token
        if (!token) {
          // Not signed in -> send to auth and come back here
          router.replace(`/auth?next=${encodeURIComponent("/survey/complete")}`)
          return
        }

        const res = await fetch("/api/survey/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ answers: draft })
        })
        if (!res.ok) throw new Error((await res.json()).error || "Failed to submit survey")

        clearDraft()
        setStatus("done")
        router.replace("/views")
      } catch (e:any) {
        setStatus("error")
        setMsg(e.message || "Something went wrong.")
      }
    }
    run()
  }, [router])

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-2 text-xl font-semibold">Finalizing…</h1>
      <p className="text-sm text-neutral-600">
        {status==="submitting" && "Submitting your answers and building your starter profile…"}
        {status==="error" && <>We hit a snag: {msg}</>}
      </p>
      {status==="error" && (
        <button className="mt-4 h-11 rounded-lg bg-black px-4 text-white" onClick={()=>router.push("/survey")}>Back to survey</button>
      )}
    </main>
  )
}
