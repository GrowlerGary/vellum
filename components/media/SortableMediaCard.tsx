'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortableMediaCardProps {
  id: string
  children: React.ReactNode
}

export function SortableMediaCard({ id, children }: SortableMediaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle — appears on hover */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-10 p-1 bg-white/80 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-zinc-400" />
      </button>
      {children}
    </div>
  )
}
