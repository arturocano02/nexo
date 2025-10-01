"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (session) {
        setAuthenticated(true)
      } else {
        router.replace("/auth")
      }
      setLoading(false)
    }
    checkAuth()
  }, [router])

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <h1 className="mb-2 text-xl font-semibold">Loading...</h1>
      </main>
    )
  }

  if (!authenticated) {
    return null
  }

  return <>{children}</>
}
