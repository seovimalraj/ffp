/**
 * Step 14: OutcomeSheet Component
 * Slide-over UI for marking quote outcomes
 */

"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  useOutcome,
  useSetOutcome,
  useDeleteOutcome,
  useReasonCodes,
  type SetOutcomeRequest,
  type QuoteOutcomeStatus,
} from "@/lib/api/useQuotes";

interface OutcomeSheetProps {
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
  canEdit?: boolean; // RBAC: quotes:mark_outcome
}

export function OutcomeSheet({
  quoteId,
  isOpen,
  onClose,
  canEdit = false,
}: OutcomeSheetProps) {
  // Queries
  const { data: outcome, isLoading } = useOutcome(quoteId);
  const { data: reasonCodes = [] } = useReasonCodes();
  const setOutcome = useSetOutcome(quoteId);
  const deleteOutcome = useDeleteOutcome(quoteId);

  // Form state
  const [status, setStatus] = useState<QuoteOutcomeStatus>("accepted");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [amount, setAmount] = useState("");

  // Sync form with existing outcome
  useEffect(() => {
    if (outcome) {
      setStatus(outcome.status);
      setReasonCode(outcome.reason_code || "");
      setReasonNotes(outcome.reason_notes || "");
      setAmount(outcome.amount?.toString() || "");
    } else {
      // Reset to defaults
      setStatus("accepted");
      setReasonCode("");
      setReasonNotes("");
      setAmount("");
    }
  }, [outcome]);

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const data: SetOutcomeRequest = {
      status,
      reason_code: reasonCode || undefined,
      reason_notes: reasonNotes || undefined,
      amount: amount ? parseFloat(amount) : undefined,
    };

    try {
      await setOutcome.mutateAsync(data);
      onClose();
    } catch (error) {
      console.error("Failed to set outcome:", error);
    }
  };

  const handleDelete = async () => {
    if (!canEdit || !outcome) return;

    if (!confirm("Are you sure you want to clear this outcome?")) return;

    try {
      await deleteOutcome.mutateAsync();
      onClose();
    } catch (error) {
      console.error("Failed to delete outcome:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Quote Outcome</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {(
                    ["accepted", "rejected", "expired", "rescinded"] as const
                  ).map((s) => (
                    <label key={s} className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={status === s}
                        onChange={(e) =>
                          setStatus(e.target.value as QuoteOutcomeStatus)
                        }
                        disabled={!canEdit}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="ml-2 text-sm capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reason Code */}
              <div>
                <label
                  htmlFor="reason-code"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Reason Code
                </label>
                <select
                  id="reason-code"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:opacity-50"
                >
                  <option value="">-- Select reason --</option>
                  {reasonCodes.map((code) => (
                    <option key={code.code} value={code.code}>
                      {code.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason Notes */}
              <div>
                <label
                  htmlFor="reason-notes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Notes
                </label>
                <textarea
                  id="reason-notes"
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                  disabled={!canEdit}
                  maxLength={2000}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:opacity-50"
                  placeholder="Additional context or details..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  {reasonNotes.length} / 2000 characters
                </p>
              </div>

              {/* Amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Final Amount ($)
                </label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:opacity-50"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Actual order amount (for variance tracking)
                </p>
              </div>

              {/* Metadata display */}
              {outcome?.decided_at && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Last updated:{" "}
                    {new Date(outcome.decided_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Actions */}
              {canEdit && (
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={setOutcome.isPending}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {setOutcome.isPending ? "Saving..." : "Save Outcome"}
                  </button>
                  {outcome && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteOutcome.isPending}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {!canEdit && (
                <div className="text-sm text-gray-500 text-center py-4">
                  You don't have permission to modify outcomes
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
