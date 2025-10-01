import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Nexo",
  description: "Your views. Your voice. Our party.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  )
}
