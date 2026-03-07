'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { StackedCards } from './StackedCards'
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_LABELS } from '@/lib/utils'

interface CollapsibleCategoryProps {
  mediaType: string
  children: React.ReactNode[]
  isExpanded?: boolean
  onToggle?: () => void
}

export function CollapsibleCategory({
  mediaType,
  children,
  isExpanded,
  onToggle,
}: CollapsibleCategoryProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = isExpanded ?? internalExpanded
  const toggle = onToggle ?? (() => setInternalExpanded((v) => !v))

  if (children.length === 0) return null

  const icon = MEDIA_TYPE_ICONS[mediaType] ?? '📦'
  const label = MEDIA_TYPE_LABELS[mediaType] ?? mediaType

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm">
      <button
        onClick={toggle}
        className="flex items-center gap-2 w-full text-left py-1 hover:bg-zinc-50 rounded-lg px-2 transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-zinc-800">{label}</span>
        <span className="text-sm text-zinc-400 ml-1">({children.length})</span>
        <span className="ml-auto text-zinc-400">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      <div className="mt-2">
        {expanded ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {children}
          </div>
        ) : (
          <StackedCards maxVisible={2}>{children}</StackedCards>
        )}
      </div>
    </div>
  )
}
