import "./globals.css"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/react"
import { Toaster } from "react-hot-toast"

export const metadata: Metadata = {
  title: "Nexo",
  description: "Your views. Your voice. Our party.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        {children}
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
