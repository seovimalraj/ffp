import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClockIcon, ArrowPathIcon, CheckCircleIcon, PlusIcon } from '@heroicons/react/24/outline'

interface Revision {
  id: string
  revision_number: number
  created_at: string
  created_by?: string
  reason?: string
  diff_summary: Array<{
    field: string
    previous?: any
    current?: any
  }>
  status: 'draft' | 'proposed' | 'applied' | 'discarded'
}

interface RevisionHistoryPanelProps {
  quoteId: string
  currentQuoteState?: any // Pass current quote data to compute diffs
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  proposed: 'bg-blue-100 text-blue-800',
  applied: 'bg-green-100 text-green-800',
  discarded: 'bg-red-100 text-red-800'
}

export function RevisionHistoryPanel({ quoteId, currentQuoteState }: Readonly<RevisionHistoryPanelProps>) {
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingRevision, setIsCreatingRevision] = useState(false)

  const handleCreateRevision = async () => {
    if (!currentQuoteState) return

    try {
      setIsCreatingRevision(true)
      const response = await fetch(`/api/quotes/${quoteId}/revisions/create-from-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_quote_state: currentQuoteState,
          reason: 'Manual revision from UI'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create revision')
      }

      // Refresh revisions
      await fetchRevisions()
    } catch (err) {
      console.error('Failed to create revision:', err)
      setError('Failed to create revision')
    } finally {
      setIsCreatingRevision(false)
    }
  }

  useEffect(() => {
    fetchRevisions()
  }, [quoteId])

  const fetchRevisions = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/quotes/${quoteId}/revisions`)

      if (!response.ok) {
        throw new Error('Failed to fetch revisions')
      }

      const data = await response.json()
      setRevisions(data.revisions || [])
    } catch (err) {
      console.error('Failed to fetch revisions:', err)
      setError('Failed to load revision history')
    } finally {
      setIsLoading(false)
    }
  }

  const formatFieldName = (field: string) => {
    return field
      .split('.')
      .map(part => part.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      .join(' → ')
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'None'
    if (typeof value === 'number') return value.toLocaleString()
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleString()
    }
    return String(value)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ClockIcon className="w-5 h-5 mr-2" />
            Revision History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading revisions...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ClockIcon className="w-5 h-5 mr-2" />
            Revision History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-600">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <ClockIcon className="w-5 h-5 mr-2" />
            Revision History
          </CardTitle>
          {currentQuoteState && (
            <Button
              size="sm"
              onClick={handleCreateRevision}
              disabled={isCreatingRevision}
              className="flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              {isCreatingRevision ? 'Creating...' : 'Create Revision'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {revisions.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No revisions yet
          </div>
        ) : (
          <div className="space-y-4">
            {revisions.map((revision) => (
              <div key={revision.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">
                      Revision #{revision.revision_number}
                    </span>
                    <Badge className={STATUS_COLORS[revision.status]}>
                      {revision.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(revision.created_at).toLocaleString()}
                  </div>
                </div>

                {revision.reason && (
                  <div className="mb-3">
                    <div className="text-sm font-medium text-gray-700">Reason:</div>
                    <div className="text-sm text-gray-600">{revision.reason}</div>
                  </div>
                )}

                {revision.created_by && (
                  <div className="mb-3">
                    <div className="text-sm font-medium text-gray-700">Created by:</div>
                    <div className="text-sm text-gray-600">{revision.created_by}</div>
                  </div>
                )}

                {revision.diff_summary.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Changes:</div>
                    <div className="space-y-2">
                      {revision.diff_summary.map((diff, index) => (
                        <div key={`${revision.id}-${diff.field}-${index}`} className="bg-gray-50 rounded p-2 text-xs">
                          <div className="font-medium text-gray-800">
                            {formatFieldName(diff.field)}
                          </div>
                          <div className="mt-1 flex items-center space-x-2">
                            {diff.previous !== undefined && (
                              <span className="text-red-600">
                                From: {formatValue(diff.previous)}
                              </span>
                            )}
                            {diff.previous !== undefined && diff.current !== undefined && (
                              <span className="text-gray-400">→</span>
                            )}
                            {diff.current !== undefined && (
                              <span className="text-green-600">
                                To: {formatValue(diff.current)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {revision.status === 'draft' && (
                  <div className="mt-3 flex space-x-2">
                    <Button size="sm" variant="outline">
                      <CheckCircleIcon className="w-4 h-4 mr-1" />
                      Apply Revision
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
