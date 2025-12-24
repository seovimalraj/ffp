'use client'

import { useCallback, useEffect, useRef } from 'react'

interface AbandonedQuoteData {
  quoteId: string
  userId?: string
  guestEmail?: string
  currentStep: 'file_upload' | 'pricing_review' | 'checkout_started' | 'payment_info'
  files: Array<{
    fileId: string
    fileName: string
    fileSize?: number
    contentType?: string
  }>
  selectedLeadOptions?: {
    [lineId: string]: string
  }
  customizations?: {
    [lineId: string]: {
      material?: string
      finish?: string
      quantity?: number
    }
  }
  checkoutData?: any
  lastActivity: string
}

interface UseAbandonedQuoteTrackingProps {
  quoteId: string
  userId?: string
  guestEmail?: string
  currentStep: AbandonedQuoteData['currentStep']
  files: AbandonedQuoteData['files']
  selectedLeadOptions?: AbandonedQuoteData['selectedLeadOptions']
  customizations?: AbandonedQuoteData['customizations']
  checkoutData?: AbandonedQuoteData['checkoutData']
  enabled?: boolean
}

export function useAbandonedQuoteTracking({
  quoteId,
  userId,
  guestEmail,
  currentStep,
  files,
  selectedLeadOptions,
  customizations,
  checkoutData,
  enabled = true
}: UseAbandonedQuoteTrackingProps) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastSavedRef = useRef<string>()

  const saveAbandonedQuote = useCallback(async () => {
    if (!enabled || !quoteId || files.length === 0) return

    const abandonedData: AbandonedQuoteData = {
      quoteId,
      userId,
      guestEmail,
      currentStep,
      files,
      selectedLeadOptions,
      customizations,
      checkoutData,
      lastActivity: new Date().toISOString()
    }

    // Only save if data has changed
    const dataHash = JSON.stringify(abandonedData)
    if (lastSavedRef.current === dataHash) return
    lastSavedRef.current = dataHash

    try {
      await fetch('/api/quotes/abandoned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(abandonedData)
      })
      console.log('Abandoned quote data saved')
    } catch (error) {
      console.error('Failed to save abandoned quote:', error)
    }
  }, [enabled, quoteId, userId, guestEmail, currentStep, files, selectedLeadOptions, customizations, checkoutData])

  const clearAbandonedQuote = useCallback(async () => {
    if (!quoteId) return

    try {
      await fetch(`/api/quotes/abandoned?quoteId=${quoteId}`, {
        method: 'DELETE'
      })
      console.log('Abandoned quote data cleared')
    } catch (error) {
      console.error('Failed to clear abandoned quote:', error)
    }
  }, [quoteId])

  // Save data on activity with debouncing
  useEffect(() => {
    if (!enabled) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Save after 30 seconds of inactivity
    timeoutRef.current = setTimeout(saveAbandonedQuote, 30000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [saveAbandonedQuote, enabled])

  // Save on page unload
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable data transmission during page unload
      if (navigator.sendBeacon && quoteId && files.length > 0) {
        const abandonedData = {
          quoteId,
          userId,
          guestEmail,
          currentStep,
          files,
          selectedLeadOptions,
          customizations,
          checkoutData,
          lastActivity: new Date().toISOString()
        }
        
        navigator.sendBeacon('/api/quotes/abandoned', JSON.stringify(abandonedData))
      } else {
        // Fallback for browsers without sendBeacon
        saveAbandonedQuote()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enabled, quoteId, userId, guestEmail, currentStep, files, selectedLeadOptions, customizations, checkoutData, saveAbandonedQuote])

  return {
    saveAbandonedQuote,
    clearAbandonedQuote
  }
}
