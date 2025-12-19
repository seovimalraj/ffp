'use client'

import React, { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface AccordionItemProps {
  id: string
  title: string
  children: React.ReactNode
  status?: 'pass' | 'warning' | 'blocker' | 'running'
  isOpen?: boolean
  onToggle?: (id: string) => void
}

export const AccordionItem = ({
  id,
  title,
  children,
  status = 'pass',
  isOpen = false,
  onToggle
}: AccordionItemProps) => {
  const handleToggle = () => {
    onToggle?.(id)
  }

  const getStatusColor = () => {
    switch (status) {
      case 'pass': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'blocker': return 'text-red-600'
      case 'running': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'pass': return '✓'
      case 'warning': return '!'
      case 'blocker': return '×'
      case 'running': return '⟳'
      default: return '?'
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className={cn("text-lg font-medium", getStatusColor())}>
            {getStatusIcon()}
          </span>
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        <ChevronDownIcon
          className={cn(
            "h-5 w-5 text-gray-500 transition-transform",
            isOpen && "transform rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

interface AccordionProps {
  items: Omit<AccordionItemProps, 'onToggle' | 'isOpen'>[]
  allowMultiple?: boolean
}

export const Accordion = ({
  items,
  allowMultiple = true
}: AccordionProps) => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const handleToggle = (id: string) => {
    setOpenItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        if (!allowMultiple) {
          newSet.clear()
        }
        newSet.add(id)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          {...item}
          isOpen={openItems.has(item.id)}
          onToggle={handleToggle}
        />
      ))}
    </div>
  )
}
