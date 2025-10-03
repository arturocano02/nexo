"use client"
import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import { useRouter } from "next/navigation"
import Navigation from "@/components/Navigation"
import RequireAuth from "@/components/RequireAuth"

interface UserStats {
  totalUsers: number
  confirmedUsers: number
  unconfirmedUsers: number
  recentUsers: Array<{
    id: string
    display_name: string
    created_at: string
  }>
}

export default function AdminPage() {
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    loadUserStats()
  }, [])

  const loadUserStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users/count')
      const data = await response.json()
      
      if (response.ok) {
        setUserStats(data)
      } else {
        setError(data.error || 'Failed to load user stats')
      }
    } catch (err) {
      setError('Failed to load user stats')
    } finally {
      setLoading(false)
    }
  }

  const refreshStats = () => {
    loadUserStats()
  }

  if (loading) {
    return (
      <RequireAuth>
        <div className="min-h-screen bg-white">
          <Navigation />
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p>Loading user statistics...</p>
            </div>
          </div>
        </div>
      </RequireAuth>
    )
  }

  if (error) {
    return (
      <RequireAuth>
        <div className="min-h-screen bg-white">
          <Navigation />
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={refreshStats}
                className="bg-black text-white px-4 py-2 rounded-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </RequireAuth>
    )
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black mb-2">User Management</h1>
            <p className="text-neutral-600">Monitor user accounts and activity</p>
          </div>

          {userStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-black mb-2">Total Users</h3>
                <p className="text-3xl font-bold text-blue-600">{userStats.totalUsers}</p>
                <p className="text-sm text-neutral-500">All registered accounts</p>
              </div>

              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-black mb-2">Confirmed Users</h3>
                <p className="text-3xl font-bold text-green-600">{userStats.confirmedUsers}</p>
                <p className="text-sm text-neutral-500">Email verified</p>
              </div>

              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-black mb-2">Pending Confirmation</h3>
                <p className="text-3xl font-bold text-orange-600">{userStats.unconfirmedUsers}</p>
                <p className="text-sm text-neutral-500">Awaiting email verification</p>
              </div>
            </div>
          )}

          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-black">Recent Users</h3>
              <button
                onClick={refreshStats}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>

            {userStats?.recentUsers && userStats.recentUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 font-medium text-neutral-600">Username</th>
                      <th className="text-left py-3 px-4 font-medium text-neutral-600">Joined</th>
                      <th className="text-left py-3 px-4 font-medium text-neutral-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStats.recentUsers.map((user) => (
                      <tr key={user.id} className="border-b border-neutral-100">
                        <td className="py-3 px-4">
                          <span className="font-medium text-black">{user.display_name}</span>
                        </td>
                        <td className="py-3 px-4 text-neutral-600">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-neutral-500 text-center py-8">No users found</p>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    </RequireAuth>
  )
}
