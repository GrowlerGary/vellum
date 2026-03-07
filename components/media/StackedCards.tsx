'use client'

import React from 'react'

interface StackedCardsProps {
  children: React.ReactNode[]
  maxVisible?: number
}

export function StackedCards({ children, maxVisible = 2 }: StackedCardsProps) {
  const visible = children.slice(0, maxVisible)
  const remaining = children.length - maxVisible

  return (
    <div className="flex gap-3 items-start flex-wrap">
      {visible.map((child, i) => (
        <div key={i} className="w-[150px] shrink-0">
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="relative w-[100px] h-[150px] flex items-center justify-center flex-shrink-0">
          {/* Stacked card visual layers */}
          <div className="absolute inset-0 bg-zinc-200 rounded-lg rotate-2" />
          <div className="absolute inset-0 bg-zinc-100 rounded-lg -rotate-1" />
          <div className="relative bg-white rounded-lg border border-zinc-200 w-full h-full flex flex-col items-center justify-center gap-1">
            <span className="text-lg font-bold text-zinc-500">+{remaining}</span>
            <span className="text-xs text-zinc-400">more</span>
          </div>
        </div>
      )}
    </div>
  )
}
