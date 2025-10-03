"use client"

interface CompassDistributionProps {
  distribution: {
    bins: {
      x: number[]
      y: number[]
      counts: number[][]
    }
  }
}

export default function CompassDistribution({ distribution }: CompassDistributionProps) {
  // Add safety checks for undefined data
  if (!distribution || !distribution.bins || !distribution.bins.counts) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-neutral-500">No distribution data available</p>
      </div>
    )
  }

  const { bins } = distribution
  
  // Ensure counts is a valid 2D array
  if (!Array.isArray(bins.counts) || bins.counts.length === 0 || !Array.isArray(bins.counts[0])) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-neutral-500">Invalid distribution data format</p>
      </div>
    )
  }

  const maxCount = Math.max(...bins.counts.flat())
  
  // Calculate total points for accessibility
  const totalPoints = bins.counts.flat().reduce((sum, count) => sum + count, 0)
  
  // Calculate quadrant counts
  const leftLibertarian = bins.counts.slice(0, 5).slice(0, 5).flat().reduce((sum, count) => sum + count, 0)
  const rightLibertarian = bins.counts.slice(0, 5).slice(5, 10).flat().reduce((sum, count) => sum + count, 0)
  const leftAuthoritarian = bins.counts.slice(5, 10).slice(0, 5).flat().reduce((sum, count) => sum + count, 0)
  const rightAuthoritarian = bins.counts.slice(5, 10).slice(5, 10).flat().reduce((sum, count) => sum + count, 0)

  return (
    <div className="w-full">
      <div className="relative aspect-square max-w-sm mx-auto">
        {/* Grid */}
        <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 gap-0">
          {bins.counts.map((row, yIndex) =>
            row.map((count, xIndex) => {
              const intensity = count / maxCount
              const opacity = Math.max(0.1, intensity * 0.8)
              
              return (
                <div
                  key={`${xIndex}-${yIndex}`}
                  className="border border-neutral-200"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${opacity})`
                  }}
                />
              )
            })
          )}
        </div>
        
        {/* Axes */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Vertical center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-neutral-300 transform -translate-x-1/2" />
          {/* Horizontal center line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-neutral-300 transform -translate-y-1/2" />
        </div>
        
        {/* Labels */}
        <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-neutral-600">
          <div className="flex justify-between">
            <span>Left</span>
            <span>Right</span>
          </div>
        </div>
        
        <div className="absolute -left-8 top-0 bottom-0 flex items-center text-xs text-neutral-600">
          <div className="transform -rotate-90">
            <div className="flex flex-col items-center">
              <span>Libertarian</span>
              <span>Authoritarian</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Accessibility summary */}
      <div className="mt-4 text-xs text-neutral-600" aria-live="polite">
        <p className="mb-2">Distribution: {totalPoints} total members</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <div className="font-medium">Left-Libertarian</div>
            <div>{leftLibertarian} members</div>
          </div>
          <div>
            <div className="font-medium">Right-Libertarian</div>
            <div>{rightLibertarian} members</div>
          </div>
          <div>
            <div className="font-medium">Left-Authoritarian</div>
            <div>{leftAuthoritarian} members</div>
          </div>
          <div>
            <div className="font-medium">Right-Authoritarian</div>
            <div>{rightAuthoritarian} members</div>
          </div>
        </div>
      </div>
    </div>
  )
}
