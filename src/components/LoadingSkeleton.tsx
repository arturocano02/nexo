"use client"

interface LoadingSkeletonProps {
  className?: string
  lines?: number
}

export default function LoadingSkeleton({ className = "", lines = 3 }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="mb-3">
          <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-neutral-100 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="h-64 bg-neutral-100 rounded-2xl flex items-center justify-center">
        <div className="text-neutral-400 text-sm">Loading chart...</div>
      </div>
    </div>
  )
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-neutral-100 rounded-2xl p-4">
        <div className="h-4 bg-neutral-200 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-neutral-200 rounded w-full"></div>
          <div className="h-3 bg-neutral-200 rounded w-2/3"></div>
          <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  )
}

export function PillarSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between">
            <div className="h-4 bg-neutral-200 rounded w-20"></div>
            <div className="h-4 bg-neutral-200 rounded w-8"></div>
          </div>
          <div className="h-2 w-full rounded bg-neutral-200">
            <div 
              className="h-2 rounded bg-neutral-300" 
              style={{ width: `${Math.random() * 80 + 20}%` }} 
            />
          </div>
        </div>
      ))}
    </div>
  )
}
