"use client";

import { User, Bot, RefreshCw, FileText, StickyNote } from "lucide-react";
import { RevisionChip } from "./RevisionChip";
import type { RevisionListItem } from "@/lib/api/revisions";
import { groupRevisionsByTime } from "@/lib/api/useRevisions";

interface RevisionTimelineProps {
  revisions: RevisionListItem[];
  onRevisionClick?: (revisionId: string) => void;
  selectedRevisionId?: string;
}

export function RevisionTimeline({
  revisions,
  onRevisionClick,
  selectedRevisionId,
}: RevisionTimelineProps) {
  const grouped = groupRevisionsByTime(revisions);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "user_update":
        return <User className="h-4 w-4" />;
      case "system_reprice":
        return <Bot className="h-4 w-4" />;
      case "restore":
        return <RefreshCw className="h-4 w-4" />;
      case "tax_update":
        return <FileText className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case "user_update":
        return "Manual Update";
      case "system_reprice":
        return "System Reprice";
      case "restore":
        return "Restored";
      case "tax_update":
        return "Tax Update";
      default:
        return eventType;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderGroup = (title: string, items: RevisionListItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-500 mb-4 px-4">
          {title}
        </h3>
        <div className="space-y-2">
          {items.map((revision) => {
            const isSelected = selectedRevisionId === revision.id;
            return (
              <button
                key={revision.id}
                onClick={() => onRevisionClick?.(revision.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      revision.event_type === "system_reprice"
                        ? "bg-purple-100 text-purple-600"
                        : revision.event_type === "restore"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {getEventIcon(revision.event_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {revision.actor.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getEventLabel(revision.event_type)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTime(revision.created_at)}
                      </span>
                    </div>

                    {/* Delta Chip */}
                    <div className="mb-2">
                      <RevisionChip
                        deltaAmount={revision.delta_amount}
                        deltaPct={revision.delta_pct}
                        size="sm"
                      />
                    </div>

                    {/* Note */}
                    {revision.note && (
                      <div className="flex items-start gap-1 mt-2 text-sm text-gray-600">
                        <StickyNote className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{revision.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (revisions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Revisions Yet
        </h3>
        <p className="text-gray-600">
          Start quoting to create revisions and track pricing changes
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      {renderGroup("Today", grouped.today)}
      {renderGroup("Yesterday", grouped.yesterday)}
      {renderGroup("Last 7 Days", grouped.lastWeek)}
      {renderGroup("Older", grouped.older)}
    </div>
  );
}
