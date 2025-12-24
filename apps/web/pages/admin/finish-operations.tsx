/**
 * Admin Finish Operations Page
 * CRUD interface for managing finish operations with formula editor
 */

"use client";

import React, { useState, useEffect } from "react";

interface FinishOperation {
  id: string;
  code: string;
  name: string;
  process: string;
  description: string | null;
  cost_formula: string;
  lead_days_formula: string;
  prerequisites_json: string[];
  incompatibilities_json: string[];
  qos_json: {
    mode: "add" | "max" | "serial";
    parallel_compatible: boolean;
    batch_discount_threshold?: number;
  };
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormulaTestResult {
  success: boolean;
  result?: number;
  error?: string;
  context?: any;
  formula?: string;
}

export default function AdminFinishOperationsPage() {
  const [operations, setOperations] = useState<FinishOperation[]>([]);
  const [selectedOp, setSelectedOp] = useState<FinishOperation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<FinishOperation>>({
    code: "",
    name: "",
    process: "cnc_milling",
    description: "",
    cost_formula: "",
    lead_days_formula: "",
    prerequisites_json: [],
    incompatibilities_json: [],
    qos_json: { mode: "add", parallel_compatible: false },
    active: true,
  });

  // Test state
  const [testFormula, setTestFormula] = useState("");
  const [testContext, setTestContext] = useState({
    area_m2: 0.25,
    volume_cm3: 150,
    qty: 10,
    material: "AL6061",
    region: "US",
    color: "black",
  });
  const [testResult, setTestResult] = useState<FormulaTestResult | null>(null);

  useEffect(() => {
    fetchOperations();
  }, []);

  const fetchOperations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/finish-operations");
      if (!res.ok) throw new Error("Failed to fetch operations");
      const data = await res.json();
      setOperations(data.operations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/finish-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create operation");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await fetchOperations();
      setIsCreating(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedOp) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/finish-operations/${selectedOp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update operation");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await fetchOperations();
      setIsEditing(false);
      setSelectedOp(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this operation?")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/finish-operations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete operation");
      await fetchOperations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleTestFormula = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/finish-operations/test-formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formula: testFormula,
          context: testContext,
        }),
      });
      if (!res.ok) throw new Error("Failed to test formula");
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      process: "cnc_milling",
      description: "",
      cost_formula: "",
      lead_days_formula: "",
      prerequisites_json: [],
      incompatibilities_json: [],
      qos_json: { mode: "add", parallel_compatible: false },
      active: true,
    });
  };

  const startEdit = (op: FinishOperation) => {
    setSelectedOp(op);
    setFormData(op);
    setIsEditing(true);
    setIsCreating(false);
  };

  const startCreate = () => {
    resetForm();
    setIsCreating(true);
    setIsEditing(false);
    setSelectedOp(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Finish Operations Management</h1>
        <button
          onClick={startCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Operation
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Operations List */}
        <div className="col-span-1 border rounded p-4 bg-white">
          <h2 className="font-semibold mb-4">
            Operations ({operations.length})
          </h2>
          {loading && !operations.length ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {operations.map((op) => (
                <div
                  key={op.id}
                  onClick={() => startEdit(op)}
                  className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                    selectedOp?.id === op.id ? "border-blue-500 bg-blue-50" : ""
                  } ${!op.active ? "opacity-50" : ""}`}
                >
                  <div className="font-medium">{op.name}</div>
                  <div className="text-xs text-gray-500">{op.code}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    v{op.version} • {op.process}
                  </div>
                  {!op.active && (
                    <span className="text-xs text-red-600">Inactive</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="col-span-2 border rounded p-4 bg-white">
          {!isCreating && !isEditing ? (
            <div className="text-center text-gray-500 py-20">
              Select an operation to edit or create a new one
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">
                {isCreating
                  ? "Create New Operation"
                  : `Edit: ${selectedOp?.name}`}
              </h2>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="bead_blast"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Bead Blast"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Process *
                  </label>
                  <select
                    value={formData.process}
                    onChange={(e) =>
                      setFormData({ ...formData, process: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="cnc_milling">CNC Milling</option>
                    <option value="turning">Turning</option>
                    <option value="sheet_metal">Sheet Metal</option>
                    <option value="3d_printing">3D Printing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    value={formData.active ? "active" : "inactive"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        active: e.target.value === "active",
                      })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                  placeholder="Brief description..."
                />
              </div>

              {/* Formulas */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cost Formula * (DSL)
                </label>
                <textarea
                  value={formData.cost_formula}
                  onChange={(e) =>
                    setFormData({ ...formData, cost_formula: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded font-mono text-sm"
                  rows={3}
                  placeholder="tiered(sa,[{upTo:0.1,price:18}])*qty*regionMult(region,'BEAD_BLAST')"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: sa, qty, material, region, color, tiered(),
                  regionMult(), hazardFee()
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Lead Days Formula * (DSL)
                </label>
                <textarea
                  value={formData.lead_days_formula}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lead_days_formula: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded font-mono text-sm"
                  rows={2}
                  placeholder="ceil(1 + (sa > 1 ? 1 : 0))"
                />
              </div>

              {/* Prerequisites & Incompatibilities */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Prerequisites
                  </label>
                  <input
                    type="text"
                    value={(formData.prerequisites_json || []).join(", ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        prerequisites_json: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="bead_blast, deburr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Incompatibilities
                  </label>
                  <input
                    type="text"
                    value={(formData.incompatibilities_json || []).join(", ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        incompatibilities_json: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="electropolish, powder_coat"
                  />
                </div>
              </div>

              {/* QoS Config */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Lead Time Mode
                  </label>
                  <select
                    value={formData.qos_json?.mode || "add"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        qos_json: {
                          ...formData.qos_json!,
                          mode: e.target.value as "add" | "max" | "serial",
                        },
                      })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="add">Add (Sequential)</option>
                    <option value="max">Max (Parallel)</option>
                    <option value="serial">Serial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Parallel Compatible
                  </label>
                  <select
                    value={
                      formData.qos_json?.parallel_compatible ? "yes" : "no"
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        qos_json: {
                          ...formData.qos_json!,
                          parallel_compatible: e.target.value === "yes",
                        },
                      })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={isCreating ? handleCreate : handleUpdate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : isCreating ? "Create" : "Update"}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setSelectedOp(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                {isEditing && selectedOp && (
                  <button
                    onClick={() => handleDelete(selectedOp.id)}
                    disabled={loading}
                    className="ml-auto px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formula Test Harness */}
      <div className="mt-6 border rounded p-4 bg-white">
        <h2 className="font-semibold text-lg mb-4">Formula Test Harness</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Formula to Test
            </label>
            <textarea
              value={testFormula}
              onChange={(e) => setTestFormula(e.target.value)}
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={3}
              placeholder="tiered(sa,[{upTo:0.1,price:18}])*qty"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Test Context (JSON)
            </label>
            <textarea
              value={JSON.stringify(testContext, null, 2)}
              onChange={(e) => {
                try {
                  setTestContext(JSON.parse(e.target.value));
                } catch (err) {
                  console.error(err);
                }
              }}
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={3}
            />
          </div>
        </div>
        <button
          onClick={handleTestFormula}
          disabled={loading || !testFormula}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Test Formula
        </button>

        {testResult && (
          <div
            className={`mt-4 p-4 border rounded ${
              testResult.success
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            {testResult.success ? (
              <div>
                <p className="font-semibold text-green-800">✓ Success</p>
                <p className="text-2xl font-mono mt-2">{testResult.result}</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-red-800">✗ Error</p>
                <p className="text-sm font-mono mt-2">{testResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
