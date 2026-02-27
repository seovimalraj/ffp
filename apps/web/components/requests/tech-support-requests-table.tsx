"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { apiClient } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toTitleCase } from "@/lib/utils";
import { DataTable, Column } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusCards, StatusItem } from "@/components/ui/status-cards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageCircleQuestion,
  Phone,
  Mail,
  Building2,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TechSupportStatus =
  | "pending"
  | "inprogress"
  | "resolved"
  | "rejected";

export interface ITechSupportRequest {
  id: string;
  code: string;
  user_id: string;
  organization_id: string;
  quote_id: string;
  user_email: string;
  user_phone: string;
  reject_reason: string | null;
  request_text: string;
  status: TechSupportStatus;
  created_at: string;
  updated_at: string;
  organizations?: { name: string };
  rfq: { rfq_code: string; status: string; order_id: string };
}

interface Cursor {
  createdAt: string;
  id: string;
}

interface Props {
  /** 'admin' sees all orgs; 'customer' is scoped to own org via the API */
  role: "admin" | "customer";
  /** rfqId to pass when calling the API – use a wildcard or specific rfqId */
  rfqId?: string;
  /** Optional: show the "Organization" column (default: true for admin) */
  showOrg?: boolean;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TechSupportStatus | "total", string> = {
  total: "blue",
  pending: "orange",
  inprogress: "teal",
  resolved: "green",
  rejected: "red",
};

const STATUS_BADGES: Record<
  TechSupportStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  inprogress: {
    label: "In Progress",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  resolved: {
    label: "Resolved",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="h-3 w-3" />,
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

function StatusBadge({ status }: { status: TechSupportStatus }) {
  const cfg = STATUS_BADGES[status] ?? STATUS_BADGES["pending"];
  return (
    <Badge
      variant="outline"
      className={`flex items-center gap-1 w-fit font-semibold text-xs px-2 py-0.5 ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ── Components ─────────────────────────────────────────────────────────────────

function ChangeStatusModal({
  item,
  isOpen,
  onClose,
  onSuccess,
}: {
  item: ITechSupportRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<TechSupportStatus>("pending");
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setRejectReason(item.reject_reason || "");
    }
  }, [item]);

  const handleSubmit = async () => {
    if (!item) return;

    // Validation
    if (status === "rejected" && !rejectReason.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.patch(`/rfq/technical-support/${item.id}`, {
        status,
        reject_reason: status === "rejected" ? rejectReason : undefined,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to update status", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Update Status
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Change the status of request{" "}
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {item?.code}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="status"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              New Status
            </Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as TechSupportStatus)}
            >
              <SelectTrigger className="h-10 w-full transition-all bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 shadow-sm">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_BADGES).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className={`space-y-2 transition-all duration-300 ${status === "rejected" ? "opacity-100 max-h-[200px]" : "opacity-40 grayscale max-h-0 overflow-hidden"}`}
          >
            <Label
              htmlFor="reject-reason"
              className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5"
            >
              <AlertTriangle className="h-3 w-3" /> Rejection Reason
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please provide a clear reason for rejection..."
              className="resize-none min-h-[100px] bg-red-50/30 border-red-100 focus:border-red-300 focus:ring-red-200"
              disabled={status !== "rejected"}
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="hover:bg-slate-100 text-slate-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || (status === "rejected" && !rejectReason.trim())
            }
            className={`${status === "rejected" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
              </>
            ) : (
              "Update Status"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────

function RequestDetailDrawer({
  request,
  onClose,
  showOrg,
}: {
  request: ITechSupportRequest | null;
  onClose: () => void;
  showOrg: boolean;
}) {
  return (
    <Sheet open={!!request} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[500px] overflow-y-auto">
        {request && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <MessageCircleQuestion className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <SheetTitle className="text-base font-black text-slate-900">
                    {request.code || "Support Request"}
                  </SheetTitle>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-0.5">
                    Technical Support
                  </p>
                </div>
              </div>
            </SheetHeader>

            <Separator className="mb-5" />

            {/* Status */}
            <div className="mb-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                Status
              </label>
              <StatusBadge status={request.status} />
            </div>

            {/* Request Text */}
            <div className="mb-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Request Details
              </label>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {request.request_text}
                </p>
              </div>
            </div>

            {/* Reject reason */}
            {request.status === "rejected" && request.reject_reason && (
              <div className="mb-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Rejection Reason
                </label>
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <p className="text-sm text-red-700 leading-relaxed">
                    {request.reject_reason}
                  </p>
                </div>
              </div>
            )}

            {/* Contact info */}
            <div className="mb-6 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                Contact
              </label>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700">
                  {request.user_email}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700">
                  {request.user_phone}
                </span>
              </div>
              {showOrg && request.organizations?.name && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-700">
                    {request.organizations.name}
                  </span>
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Created
                </p>
                <p className="text-xs font-semibold text-slate-700">
                  {formatDate(request.created_at)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Updated
                </p>
                <p className="text-xs font-semibold text-slate-700">
                  {formatDate(request.updated_at)}
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TechSupportRequestsTable({
  role,
  rfqId = "all",
  showOrg,
}: Props) {
  const isAdmin = role === "admin";
  const shouldShowOrg = showOrg ?? isAdmin;

  const [requests, setRequests] = useState<ITechSupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Any");
  const [selectedRequest, setSelectedRequest] =
    useState<ITechSupportRequest | null>(null);
  const [itemToUpdate, setItemToUpdate] = useState<ITechSupportRequest | null>(
    null,
  );

  // Keep a live ref to avoid stale closure in fetchRequests
  const requestsRef = useRef<ITechSupportRequest[]>([]);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRequests = useCallback(
    async (isNext = false) => {
      if (isNext) setIsFetchingMore(true);
      else setLoading(true);

      try {
        const current = requestsRef.current;
        const lastItem = isNext ? current[current.length - 1] : null;

        const cursor: Partial<Cursor> = lastItem
          ? { createdAt: lastItem.created_at, id: lastItem.id }
          : {};

        const params: Record<string, string | number | undefined> = {
          limit: 20,
          ...(statusFilter !== "Any" && { status: statusFilter.toLowerCase() }),
          ...(cursor.createdAt && { cursorCreatedAt: cursor.createdAt }),
          ...(cursor.id && { cursorId: cursor.id }),
        };

        const response = await apiClient.get(`/rfq/${rfqId}/tech-support`, {
          params,
        });

        const newData: ITechSupportRequest[] = response.data.ts_requests || [];

        setRequests((prev) => (isNext ? [...prev, ...newData] : newData));
        setHasMore(response.data.hasMore ?? false);
      } catch (err) {
        console.error("Failed to fetch tech support requests:", err);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [rfqId, statusFilter],
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ── Status cards ───────────────────────────────────────────────────────────

  const statuses = useMemo<StatusItem[]>(() => {
    const counts: Record<string, number> = { total: requests.length };
    requests.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });

    const allStatuses: (TechSupportStatus | "total")[] = [
      "total",
      "pending",
      "inprogress",
      "resolved",
      "rejected",
    ];

    return allStatuses.map((s, i) => ({
      label: s === "total" ? "Total Requests" : toTitleCase(s),
      value: counts[s] ?? 0,
      color: STATUS_COLORS[s] as StatusItem["color"],
      priority: i + 1,
      onClick: () => setStatusFilter(s === "total" ? "Any" : s),
      highlight:
        s === "total"
          ? statusFilter === "Any"
          : statusFilter.toLowerCase() === s,
    }));
  }, [requests, statusFilter]);

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<ITechSupportRequest>[] = useMemo(
    () => [
      {
        key: "code",
        header: "Code",
        render: (row) => (
          <span className="font-mono font-bold text-xs text-slate-600 uppercase">
            {row.code || "—"}
          </span>
        ),
      },
      ...(shouldShowOrg
        ? ([
            {
              key: "organization",
              header: "Organization",
              render: (row: ITechSupportRequest) => (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 font-medium">
                    {row.organizations?.name ?? "—"}
                  </span>
                </div>
              ),
            },
          ] as Column<ITechSupportRequest>[])
        : []),
      {
        key: "user_email",
        header: "Contact",
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-slate-800 font-medium">
              {row.user_email}
            </span>
            <span className="text-[11px] text-slate-400">{row.user_phone}</span>
          </div>
        ),
      },
      {
        key: "request_text",
        header: "Request",
        render: (row) => (
          <p className="text-sm text-slate-600 truncate max-w-[260px]">
            {row.request_text}
          </p>
        ),
      },
      {
        key: "rfq",
        header: "RFQ",
        render: (row) => {
          const redirectTo =
            role === "admin"
              ? `/admin/quotes/${row.quote_id}`
              : row.rfq.status === "draft"
                ? `/quote-config/${row.quote_id}`
                : row.rfq.status === "paid"
                  ? `/portal/orders/${row.rfq.order_id}`
                  : row.rfq.status === "submitted" ||
                      row.rfq.status === "payment pending"
                    ? `/checkout/${row.quote_id}`
                    : `/portal/quotes/${row.quote_id}`;

          return (
            <Link
              href={redirectTo}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {row.rfq.rfq_code}
            </Link>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "created_at",
        header: "Submitted",
        render: (row) => (
          <span className="text-sm text-slate-500">
            {formatDate(row.created_at)}
          </span>
        ),
      },
    ],
    [shouldShowOrg],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Status Cards */}
      <StatusCards isLoading={loading} items={statuses} minimal={true} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800/60 transition-all">
        <div className="flex flex-1 flex-wrap items-center gap-8">
          <div className="flex items-center gap-1 p-1 bg-gray-100/50 dark:bg-gray-800/40 rounded-xl relative border border-gray-200/50 dark:border-gray-700/50">
            <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap">
              Status
            </span>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val)}
            >
              <SelectTrigger
                id="ts-status-filter"
                className="h-8 min-w-[160px] bg-transparent border-none shadow-none focus:ring-0 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all rounded-lg px-3 font-bold text-sm text-gray-900 dark:text-gray-100"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${statusFilter === "Any" ? "bg-blue-500" : "bg-emerald-500"}`}
                  />
                  <SelectValue placeholder="Select status" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 dark:border-gray-800 shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-gray-950/90">
                <SelectItem value="Any" className="font-medium">
                  All Statuses
                </SelectItem>
                {(
                  ["pending", "inprogress", "resolved", "rejected"] as const
                ).map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    className="font-medium capitalize"
                  >
                    {STATUS_BADGES[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-4 mt-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-48 h-4" />
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-24 h-4" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <MessageCircleQuestion className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-1">
              No requests found
            </h3>
            <p className="text-sm text-slate-400">
              {statusFilter !== "Any"
                ? `No "${STATUS_BADGES[statusFilter as TechSupportStatus]?.label}" requests to show.`
                : "No technical support requests have been submitted yet."}
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={requests}
            keyExtractor={(r) => r.id}
            emptyMessage="No requests found"
            isLoading={loading || isFetchingMore}
            numbering={true}
            hasMore={hasMore}
            onEndReached={() => {
              if (hasMore && !isFetchingMore) fetchRequests(true);
            }}
            actions={[
              {
                label: "View",
                onClick: (row) => setSelectedRequest(row),
              },
              ...(role === "admin"
                ? [
                    {
                      label: "Change Status",
                      disabled: (row: { status: string }) =>
                        row.status === "resolved" || row.status === "rejected",
                      onClick: (
                        row: React.SetStateAction<ITechSupportRequest | null>,
                      ) => setItemToUpdate(row),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>

      {/* Detail Drawer */}
      <RequestDetailDrawer
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        showOrg={shouldShowOrg}
      />

      {/* Change Status Modal */}
      <ChangeStatusModal
        item={itemToUpdate}
        isOpen={!!itemToUpdate}
        onClose={() => setItemToUpdate(null)}
        onSuccess={() => fetchRequests(false)}
      />
    </div>
  );
}
