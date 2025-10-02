"use client"
import { usePathname, useRouter } from "next/navigation"

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { path: "/chat", label: "Chat", icon: "💬" },
    { path: "/views", label: "Views", icon: "📊" },
    { path: "/settings", label: "Settings", icon: "⚙️" }
  ]

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-neutral-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-center px-4 py-2">
        <div className="flex bg-neutral-100 rounded-2xl p-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path || 
              (item.path === "/views" && pathname.startsWith("/views"))
            
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "bg-white text-black shadow-sm" 
                    : "text-neutral-600 hover:text-black hover:bg-white/50"
                }`}
                title={item.label}
              >
                <span className="text-xl">{item.icon}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
