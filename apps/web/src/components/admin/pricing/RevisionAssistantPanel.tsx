"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ContractsV1 } from "@cnc-quote/shared";
import type { AdminPricingConfig } from "@cnc-quote/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowPathIcon, SparklesIcon, CheckCircleIcon, ShieldCheckIcon, NoSymbolIcon } from "@heroicons/react/24/outline";

interface RevisionAssistantPanelProps {
  currentConfig: AdminPricingConfig | null;
  onApplyProposal: (config: AdminPricingConfig, context: { runId: string }) => void;
}

type AssistantRun = ContractsV1.AdminPricingRevisionAssistantRunV1;

type SubmissionState = "idle" | "submitting" | "queued" | "processing";

const formatNumber = (value: number | undefined | null): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
};

export const RevisionAssistantPanel: React.FC<RevisionAssistantPanelProps> = ({ currentConfig, onApplyProposal }) => {
  const [instructions, setInstructions] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [runs, setRuns] = useState<AssistantRun[]>([]);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalSubmission, setApprovalSubmission] = useState<"approved" | "rejected" | null>(null);

  const approvalsTarget = 2;

  const upsertRun = useCallback((run: AssistantRun) => {
    setRuns((prev) => {
      const next = prev.filter((item) => item.runId !== run.runId);
      return [run, ...next].slice(0, 10);
    });
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/pricing/revision-assistant");
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          setError("Revision assistant is disabled for this environment.");
          return;
        }
        throw new Error(`Failed to load revision assistant runs (${response.status})`);
      }
      const payload = await response.json();
      if (Array.isArray(payload)) {
        setRuns(payload);
      }
    } catch (err) {
      console.error("Failed to load revision assistant runs", err);
      setError((err as Error).message);
    }
  }, []);

  const fetchRunById = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/admin/pricing/revision-assistant/${runId}`);
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          setError("Revision assistant is disabled for this environment.");
          setSubmissionState("idle");
          setActiveRunId(null);
          return;
        }
        throw new Error(`Failed to load run ${runId} (${response.status})`);
      }
      const run = (await response.json()) as AssistantRun;
      upsertRun(run);
      if (run.status === "succeeded" || run.status === "failed") {
        setSubmissionState("idle");
        setActiveRunId(null);
      } else if (run.status === "processing") {
        setSubmissionState("processing");
      }
    } catch (err) {
      console.error("Failed to refresh assistant run", err);
      setError((err as Error).message);
    }
  }, [upsertRun]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (!activeRunId) return;
    const interval = setInterval(() => {
      fetchRunById(activeRunId).catch((err) => {
        console.error("Polling revision assistant run failed", err);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [activeRunId, fetchRunById]);

  const latestRun = runs.length ? runs[0] : null;
  const assistantDisabled = useMemo(() => Boolean(error?.toLowerCase().includes("disabled")), [error]);

  const handleSubmit = async () => {
    if (!instructions.trim()) {
      setError("Provide instructions before requesting a draft");
      return;
    }
    if (assistantDisabled) {
      return;
    }

    setError(null);
    setSubmissionState("submitting");

    const focus = focusAreas
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    try {
      const response = await fetch("/api/admin/pricing/revision-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, instructions, focusAreas: focus.length ? focus : undefined }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? `Assistant request failed (${response.status})`);
      }

  const run = (await response.json()) as AssistantRun;
  upsertRun(run);
      setActiveRunId(run.runId);
      setSubmissionState("queued");
    } catch (err) {
      setSubmissionState("idle");
      setError((err as Error).message);
    }
  };

  const canApplyProposal = useMemo(() => latestRun?.status === "succeeded" && latestRun.proposalConfig, [latestRun]);

  const renderStatusBadge = (status: AssistantRun["status"]) => {
    switch (status) {
      case "succeeded":
        return <Badge className="bg-green-600 text-white">Ready</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
  
      case "processing":
        return (
          <Badge variant="outline">
            <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" /> Processing
          </Badge>
        );
      default:
        return <Badge variant="outline">Queued</Badge>;
    }
  };

  const applyProposal = () => {
    if (latestRun?.proposalConfig) {
      onApplyProposal(latestRun.proposalConfig, { runId: latestRun.runId });
    }
  };

  const submitApproval = async (decision: "approved" | "rejected") => {
    if (!latestRun) return;

    setApprovalSubmission(decision);
    setError(null);

    try {
      const response = await fetch(`/api/admin/pricing/revision-assistant/${latestRun.runId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, decision }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? `Approval request failed (${response.status})`);
      }

      const updated = (await response.json()) as AssistantRun;
      upsertRun(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApprovalSubmission(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <SparklesIcon className="w-5 h-5 text-blue-600" /> Interactive Revision Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Provide guidance and the assistant will draft multiplier or rule tweaks based on the current configuration. Publishing still requires manual approval.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Instructions</label>
          <Textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="E.g. Tighten expedited multipliers for EU while keeping standard pricing stable."
            rows={3}
            disabled={assistantDisabled}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Focus Areas (comma separated)</label>
          <Input
            value={focusAreas}
            onChange={(event) => setFocusAreas(event.target.value)}
            placeholder="expedited, eu, margin"
            disabled={assistantDisabled}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={assistantDisabled || submissionState === "submitting" || submissionState === "processing"}>
            {submissionState === "submitting" ? (
              <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <SparklesIcon className="w-4 h-4 mr-2" />
            )}
            Draft Revision
          </Button>
          {submissionState !== "idle" && (
            <span className="text-xs text-muted-foreground">
              {submissionState === "queued" && "Queued for generation"}
              {submissionState === "processing" && "Generating proposal..."}
              {submissionState === "submitting" && "Sending request"}
            </span>
          )}
          <Button variant="outline" onClick={fetchRuns}>
            Refresh History
          </Button>
        </div>

        {latestRun && (
          <div className="border rounded-md p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Latest Draft</p>
                <p className="text-xs text-muted-foreground">Run ID {latestRun.runId}</p>
              </div>
              {renderStatusBadge(latestRun.status)}
            </div>

            {latestRun.status === "succeeded" && latestRun.approvalRequired !== false && (
              <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-3">
                {(() => {
                  const approvalsList = latestRun.approvals ?? [];
                  const approvedCount = approvalsList.filter((item) => item.decision === "approved").length;
                  const rejectedCount = approvalsList.filter((item) => item.decision === "rejected").length;
                  const dualControlSatisfied = latestRun.approvalState === "approved";

                  return (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Dual Control
                          </p>
                          <p className="text-sm flex items-center gap-2">
                            {dualControlSatisfied ? (
                              <>
                                <ShieldCheckIcon className="w-4 h-4 text-green-600" />
                                Approved ({approvedCount}/{approvalsTarget})
                              </>
                            ) : (
                              <>
                                <ShieldCheckIcon className="w-4 h-4 text-amber-500" />
                                Approvals {approvedCount}/{approvalsTarget} required
                              </>
                            )}
                          </p>
                          {rejectedCount > 0 && (
                            <p className="text-xs text-red-600">
                              {rejectedCount} reviewer{rejectedCount > 1 ? "s" : ""} rejected this draft
                            </p>
                          )}
                        </div>
                        {dualControlSatisfied && <Badge className="bg-green-600 text-white">Ready for Publish</Badge>}
                      </div>

                      {!dualControlSatisfied && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            disabled={approvalSubmission !== null || latestRun.status !== "succeeded"}
                            onClick={() => submitApproval("approved")}
                          >
                            {approvalSubmission === "approved" ? (
                              <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <ShieldCheckIcon className="w-4 h-4 mr-2" />
                            )}
                            Approve Draft
                          </Button>
                          <Button
                            variant="outline"
                            disabled={approvalSubmission !== null || latestRun.status !== "succeeded"}
                            onClick={() => submitApproval("rejected")}
                          >
                            {approvalSubmission === "rejected" ? (
                              <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <NoSymbolIcon className="w-4 h-4 mr-2" />
                            )}
                            Reject
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Two distinct approvers must accept before publish.
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {latestRun.diffSummary?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highlights</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {latestRun.diffSummary.map((item, index) => (
                    <li key={`${latestRun.runId}-diff-${index}`} className="list-disc ml-5">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {latestRun.adjustments?.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adjustment Details</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="text-left font-semibold px-2 py-1">Path</th>
                        <th className="text-left font-semibold px-2 py-1">Type</th>
                        <th className="text-left font-semibold px-2 py-1">Before</th>
                        <th className="text-left font-semibold px-2 py-1">After</th>
                        <th className="text-left font-semibold px-2 py-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestRun.adjustments.map((adjustment, index) => (
                        <tr key={`${latestRun.runId}-adj-${index}`} className="border-b last:border-none">
                          <td className="px-2 py-1 font-mono text-[11px]">{adjustment.path}</td>
                          <td className="px-2 py-1 capitalize">{adjustment.type}</td>
                          <td className="px-2 py-1">{formatNumber(adjustment.beforeValue)}</td>
                          <td className="px-2 py-1 text-blue-700 dark:text-blue-300">{formatNumber(adjustment.afterValue ?? adjustment.value)}</td>
                          <td className="px-2 py-1 w-1/2">{adjustment.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {latestRun.notes && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Notes:</span> {latestRun.notes}
              </div>
            )}

            {latestRun.error && (
              <div className="text-sm text-red-600">
                <span className="font-medium">Error:</span> {latestRun.error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={applyProposal}
                disabled={!canApplyProposal || !latestRun.proposalConfig || !currentConfig}
              >
                <CheckCircleIcon className="w-4 h-4 mr-2" /> Apply Proposal to Draft
              </Button>
              <span className="text-xs text-muted-foreground">
                Applying overwrites the working draft fields suggested in this run.
              </span>
            </div>
          </div>
        )}

        {runs.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {runs.slice(1).map((run) => (
                <div key={run.runId} className="flex items-center justify-between border rounded px-2 py-1">
                  <span className="truncate">{run.instructions.slice(0, 80)}</span>
                  {renderStatusBadge(run.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
