"use client"
import { useState, useEffect } from "react"

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export default function PageTransition({ children, className = "" }: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 50)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div 
      className={`
        transition-all duration-500 ease-out transform
        ${isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4'
        }
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div 
      className={`
        transition-all duration-700 ease-out transform
        ${isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-6'
        }
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function SlideIn({ children, direction = "left", delay = 0, className = "" }: { 
  children: React.ReactNode; 
  direction?: "left" | "right" | "up" | "down"; 
  delay?: number; 
  className?: string 
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  const getTransform = () => {
    if (!isVisible) {
      switch (direction) {
        case "left": return "translate-x-8"
        case "right": return "-translate-x-8"
        case "up": return "translate-y-8"
        case "down": return "-translate-y-8"
        default: return "translate-x-8"
      }
    }
    return "translate-x-0 translate-y-0"
  }

  return (
    <div 
      className={`
        transition-all duration-600 ease-out transform
        ${isVisible 
          ? 'opacity-100 translate-x-0 translate-y-0' 
          : `opacity-0 ${getTransform()}`
        }
        ${className}
      `}
    >
      {children}
    </div>
  )
}
