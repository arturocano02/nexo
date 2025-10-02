"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import RequireAuth from "@/components/RequireAuth"
import Navigation from "@/components/Navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsPageInner />
    </RequireAuth>
  )
}

function SettingsPageInner() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supa = supabaseBrowser()
        const { data: { user } } = await supa.auth.getUser()
        setUser(user)

        // Load profile data
        if (user) {
          const { data: profileData } = await supa
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single()
          
          setProfile(profileData)
        }
      } catch (error) {
        console.error("Error loading user:", error)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    try {
      const supa = supabaseBrowser()
      
      // Update profile in profiles table
      const { error: profileError } = await supa
        .from("profiles")
        .upsert({
          id: user.id,
          display_name: profile?.display_name || "",
          bio: profile?.bio || "",
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      if (profileError) throw profileError

      // Also update user metadata
      const { error: userError } = await supa.auth.updateUser({
        data: {
          display_name: profile?.display_name || "",
          bio: profile?.bio || ""
        }
      })

      if (userError) throw userError
      
      setMessage("Profile updated successfully!")
    } catch (error: any) {
      setMessage(error.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      const supa = supabaseBrowser()
      await supa.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleClearChatHistory = async () => {
    try {
      const supa = supabaseBrowser()
      
      // Get user's conversation
      const { data: conversation } = await supa
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (conversation) {
        // Delete messages
        await supa
          .from("messages")
          .delete()
          .eq("conversation_id", conversation.id)

        // Delete conversation
        await supa
          .from("conversations")
          .delete()
          .eq("id", conversation.id)
      }

      setMessage("Chat history cleared successfully!")
      setShowClearChatConfirm(false)
    } catch (error: any) {
      setMessage(error.message || "Failed to clear chat history")
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return

    try {
      const supa = supabaseBrowser()
      
      // Delete all user data in order
      await supa.from("messages").delete().eq("user_id", user.id)
      await supa.from("conversations").delete().eq("user_id", user.id)
      await supa.from("survey_responses").delete().eq("user_id", user.id)
      await supa.from("view_updates").delete().eq("user_id", user.id)
      await supa.from("views_snapshots").delete().eq("user_id", user.id)
      await supa.from("profiles").delete().eq("id", user.id)

      // Sign out and redirect
      await supa.auth.signOut()
      router.push("/")
      
      // Show success message
      alert("Account deleted successfully")
    } catch (error: any) {
      setMessage(error.message || "Failed to delete account")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="px-4 py-6">
          <div className="text-center">Loading...</div>
        </div>
        <Navigation />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-3">
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </div>

      {/* Main Content */}
      <main 
        className="px-4 py-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
      >
        <div className="max-w-md mx-auto space-y-6">
          {/* Account Section */}
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="text-lg font-semibold mb-4">Account</h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-neutral-50 text-neutral-500"
                />
                <p className="text-xs text-neutral-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={profile?.display_name || ""}
                  onChange={(e) => setProfile({
                    ...profile,
                    display_name: e.target.value
                  })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Your display name"
                />
              </div>

              {message && (
                <div className={`text-sm ${message.includes("successfully") ? "text-green-600" : "text-red-600"}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full h-11 rounded-lg bg-black text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Update Profile"}
              </button>
            </form>
          </section>

          {/* Data Section */}
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="text-lg font-semibold mb-4">Data</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => router.push("/survey")}
                className="w-full h-11 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              >
                Re-take Survey
              </button>

              <button
                onClick={() => setShowClearChatConfirm(true)}
                className="w-full h-11 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                Clear Chat History
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full h-11 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
              >
                Delete My Account
              </button>
            </div>
          </section>

          {/* Security Section */}
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="text-lg font-semibold mb-4">Security</h2>
            
            <div className="space-y-3">
              <button
                onClick={handleSignOut}
                className="w-full h-11 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              >
                Sign Out
              </button>
            </div>
          </section>

          {/* About Section */}
          <section className="rounded-2xl border border-neutral-200 p-4">
            <h2 className="text-lg font-semibold mb-4">About</h2>
            
            <div className="space-y-3 text-sm text-neutral-600">
              <div>
                <span className="font-medium">Version:</span> 1.0.0
              </div>
              <div>
                <span className="font-medium">Privacy:</span> We store your survey responses, chat messages, and derived political views to personalize the app. Aggregated data is anonymized and used to show party-wide insights.
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Clear Chat Confirmation Modal */}
      {showClearChatConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Clear Chat History</h3>
            <p className="text-sm text-neutral-600 mb-4">
              This will permanently delete all your chat messages. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearChatConfirm(false)}
                className="flex-1 h-11 rounded-lg border border-neutral-300 text-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChatHistory}
                className="flex-1 h-11 rounded-lg bg-orange-600 text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Delete Account</h3>
            <p className="text-sm text-neutral-600 mb-4">
              This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Type "DELETE" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText("")
                }}
                className="flex-1 h-11 rounded-lg border border-neutral-300 text-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE"}
                className="flex-1 h-11 rounded-lg bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  )
}
