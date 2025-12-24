/**
 * Step 16: Revision Timeline Component
 * Vertical timeline with time-grouped revisions
 */

"use client";

import { useState } from "react";
import { ChevronRight, MessageSquare, MoreVertical } from "lucide-react";
import { RevisionChip } from "./RevisionChip";
import type { RevisionListItem } from "@/lib/api/revisions";

interface TimelineProps {
  revisions: RevisionListItem[];
  onSelect: (revisionId: string) => void;
  selectedId?: string;
  loading?: boolean;
}

export function RevisionTimeline({
  revisions,
  onSelect,
  selectedId,
  loading = false,
}: TimelineProps) {
  // Group by time
  const grouped = groupByTime(revisions);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium mb-2">No revisions yet</p>
        <p className="text-sm">
          Start quoting to create revisions and track pricing changes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          {/* Time Group Header */}
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            {formatTimeGroup(group)}
          </h3>

          {/* Timeline Items */}
          <div className="space-y-3 relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            {items.map((item) => (
              <TimelineItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onClick={() => onSelect(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TimelineItemProps {
  item: RevisionListItem;
  isSelected: boolean;
  onClick: () => void;
}

function TimelineItem({ item, isSelected, onClick }: TimelineItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`relative pl-10 pr-4 py-3 rounded-lg border-2 transition-all cursor-pointer ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-transparent hover:border-gray-200 hover:bg-gray-50"
      }`}
      onClick={onClick}
    >
      {/* Timeline dot */}
      <div
        className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${
          isSelected
            ? "bg-blue-600 border-blue-600"
            : "bg-white border-gray-300"
        }`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Actor & Time */}
          <div className="flex items-baseline gap-2 mb-2">
            {item.actor ? (
              <span className="font-medium text-gray-900">
                {item.actor.name}
              </span>
            ) : (
              <span className="font-medium text-gray-500">System</span>
            )}
            <span className="text-xs text-gray-500">
              {formatRelativeTime(item.created_at)}
            </span>
          </div>

          {/* Chips */}
          <div className="mb-2">
            <RevisionChip
              eventType={item.event_type}
              deltaAmount={item.delta_amount}
              deltaPct={item.delta_pct}
              size="sm"
            />
          </div>

          {/* Note */}
          {item.note && (
            <div className="flex items-start gap-2 text-sm text-gray-600 mt-2">
              <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p className="line-clamp-2">{item.note}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <MoreVertical className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Select indicator */}
      {isSelected && (
        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600" />
      )}
    </div>
  );
}

// Helper functions
function calculateTimeGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "last_7_days";
  if (diffDays <= 30) return "last_30_days";
  return "older";
}

function groupByTime(
  revisions: RevisionListItem[],
): Record<string, RevisionListItem[]> {
  const grouped: Record<string, RevisionListItem[]> = {
    today: [],
    yesterday: [],
    last_7_days: [],
    last_30_days: [],
    older: [],
  };

  for (const revision of revisions) {
    const group =
      revision.time_group || calculateTimeGroup(revision.created_at);
    if (group in grouped) {
      grouped[group].push(revision);
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(grouped).filter(([_, items]) => items.length > 0),
  );
}

function formatTimeGroup(group: string): string {
  const labels: Record<string, string> = {
    today: "Today",
    yesterday: "Yesterday",
    last_7_days: "Last 7 Days",
    last_30_days: "Last 30 Days",
    older: "Older",
  };
  return labels[group] || group;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
