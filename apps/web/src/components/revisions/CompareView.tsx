"use client";

import { useState } from "react";
import { X, Download, Eye, EyeOff } from "lucide-react";
import { RevisionChip } from "./RevisionChip";
import { FactorDeltaBadge } from "./FactorDeltaBadge";
import type { CompareRevisionsResponse } from "@/lib/api/revisions";

interface CompareViewProps {
  isOpen: boolean;
  onClose: () => void;
  comparison: CompareRevisionsResponse | null;
}

export function CompareView({ isOpen, onClose, comparison }: CompareViewProps) {
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);

  if (!isOpen || !comparison) return null;

  const { a, b, diff_json } = comparison;

  const formatFieldPath = (path: string) => {
    return path.split("/").filter(Boolean).join(" → ");
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const exportToCsv = () => {
    const rows = [
      ["Field", "From", "To", "Delta"],
      ...diff_json.fields.map((field) => [
        formatFieldPath(field.path),
        formatValue(field.from),
        formatValue(field.to),
        "",
      ]),
      [],
      ["Factor", "Delta ($)", "Delta (%)", ""],
      ...diff_json.by_factor.map((factor) => [
        factor.factor,
        factor.delta.toFixed(2),
        (factor.pct * 100).toFixed(2) + "%",
        "",
      ]),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revision-comparison-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Full-screen drawer */}
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-y-0 right-0 max-w-7xl w-full flex">
            <div className="w-full bg-white shadow-xl overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Compare Revisions</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Version {a.version} vs Version {b.version}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowOnlyChanged(!showOnlyChanged)}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      {showOnlyChanged ? (
                        <>
                          <Eye className="h-4 w-4" />
                          <span>Show All</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4" />
                          <span>Changed Only</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={exportToCsv}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Total Change
                  </h3>
                  <RevisionChip
                    deltaAmount={diff_json.summary.total_delta_amount}
                    deltaPct={diff_json.summary.total_delta_pct}
                    size="lg"
                  />
                </div>

                {/* Factor Deltas */}
                {diff_json.by_factor.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Cost Factor Changes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {diff_json.by_factor.map((factor, idx) => (
                        <FactorDeltaBadge
                          key={idx}
                          factor={factor.factor}
                          delta={factor.delta}
                          pct={factor.pct}
                          size="md"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Field Changes */}
                {diff_json.fields.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Field Changes ({diff_json.fields.length})
                    </h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-gray-700">
                              Field
                            </th>
                            <th className="text-left px-4 py-2 font-medium text-gray-700">
                              From (v{a.version})
                            </th>
                            <th className="text-left px-4 py-2 font-medium text-gray-700">
                              To (v{b.version})
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {diff_json.fields.map((field, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                {formatFieldPath(field.path)}
                              </td>
                              <td className="px-4 py-3">
                                <code className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                                  {formatValue(field.from)}
                                </code>
                              </td>
                              <td className="px-4 py-3">
                                <code className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                                  {formatValue(field.to)}
                                </code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Line Deltas */}
                {diff_json.lines.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Line Item Changes ({diff_json.lines.length})
                    </h3>
                    <div className="space-y-4">
                      {diff_json.lines.map((line, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono text-xs text-gray-600">
                              {line.line_id}
                            </span>
                            <div className="flex items-center gap-2">
                              {line.price_from !== null &&
                                line.price_to !== null && (
                                  <span className="text-sm text-gray-600">
                                    ${line.price_from.toFixed(2)} →{" "}
                                    <strong>${line.price_to.toFixed(2)}</strong>
                                  </span>
                                )}
                            </div>
                          </div>
                          {line.factor_deltas.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {line.factor_deltas.map((fd, fdIdx) => (
                                <FactorDeltaBadge
                                  key={fdIdx}
                                  factor={fd.factor}
                                  delta={fd.delta}
                                  pct={fd.pct}
                                  size="sm"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {diff_json.fields.length === 0 &&
                  diff_json.by_factor.length === 0 &&
                  diff_json.lines.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-600">
                        No differences detected between these revisions
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
