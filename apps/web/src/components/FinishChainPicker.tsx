/**
 * Finish Chain Picker Component
 * Searchable list with drag-drop reordering and compatibility guardrails
 */

import React, { useState, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { useFinishChain } from "../hooks/useFinishChain";
import { ChainStep, FinishOperation } from "../types/finish-chain";

interface FinishChainPickerProps {
  quoteId: string;
  lineId: string;
  process?: string;
  geometry: {
    surface_area_m2: number;
    volume_cm3: number;
  };
  quantity: number;
  material: string;
  region: string;
  onChainUpdate?: (totalCostCents: number, addedLeadDays: number) => void;
}

export const FinishChainPicker: React.FC<FinishChainPickerProps> = ({
  quoteId,
  lineId,
  process,
  geometry,
  quantity,
  material,
  region,
  onChainUpdate,
}) => {
  const {
    operations,
    chain,
    validationErrors,
    loading,
    error,
    updateChain,
    deleteChain,
  } = useFinishChain({ quoteId, lineId, process });

  const [searchTerm, setSearchTerm] = useState("");
  const [localSteps, setLocalSteps] = useState<ChainStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local steps with fetched chain
  React.useEffect(() => {
    if (chain) {
      setLocalSteps(chain.steps);
    }
  }, [chain]);

  // Filter operations by search
  const filteredOperations = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return operations.filter(
      (op) =>
        op.name.toLowerCase().includes(term) ||
        op.code.toLowerCase().includes(term),
    );
  }, [operations, searchTerm]);

  // Check if operation is already in chain
  const isInChain = (code: string) =>
    localSteps.some((s) => s.operation_code === code);

  // Check if operation is compatible
  const isCompatible = (op: FinishOperation) => {
    // Check incompatibilities
    for (const step of localSteps) {
      const stepOp = operations.find((o) => o.code === step.operation_code);
      if (!stepOp) continue;
      if (stepOp.incompatibilities_json.includes(op.code)) return false;
      if (op.incompatibilities_json.includes(stepOp.code)) return false;
    }
    return true;
  };

  // Check if operation prerequisites are met
  const prerequisitesMet = (op: FinishOperation) => {
    const currentCodes = new Set(localSteps.map((s) => s.operation_code));
    return op.prerequisites_json.every((prereq) => currentCodes.has(prereq));
  };

  // Add operation to chain
  const addOperation = (op: FinishOperation) => {
    if (isInChain(op.code)) return;
    if (!isCompatible(op)) return;

    const newStep: ChainStep = {
      operation_code: op.code,
      operation_name: op.name,
      sequence: localSteps.length + 1,
      params: {},
    };
    setLocalSteps([...localSteps, newStep]);
  };

  // Remove operation from chain
  const removeOperation = (code: string) => {
    setLocalSteps(localSteps.filter((s) => s.operation_code !== code));
  };

  // Handle drag end
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(localSteps);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    // Update sequences
    const updatedSteps = items.map((step, idx) => ({
      ...step,
      sequence: idx + 1,
    }));

    setLocalSteps(updatedSteps);
  };

  // Save chain
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const context = {
        area_m2: geometry.surface_area_m2,
        volume_cm3: geometry.volume_cm3,
        qty: quantity,
        material,
        region,
      };

      const steps = localSteps.map((s) => ({
        operation_code: s.operation_code,
        params: s.params,
      }));

      const updatedChain = await updateChain(steps, context);
      if (onChainUpdate) {
        onChainUpdate(
          updatedChain.total_cost_cents,
          updatedChain.added_lead_days,
        );
      }
    } catch (err) {
      console.error("Failed to save chain:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear chain
  const handleClear = async () => {
    try {
      setIsSaving(true);
      await deleteChain();
      setLocalSteps([]);
      if (onChainUpdate) {
        onChainUpdate(0, 0);
      }
    } catch (err) {
      console.error("Failed to clear chain:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !operations.length) {
    return <div className="p-4">Loading finish operations...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="finish-chain-picker space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Finish Operations</h3>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            disabled={isSaving || localSteps.length === 0}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Clear All
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Chain"}
          </button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="font-semibold text-red-800 mb-2">Validation Errors:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Available Operations */}
        <div className="border rounded p-4">
          <h4 className="font-semibold mb-2">Available Operations</h4>
          <input
            type="text"
            placeholder="Search operations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded mb-3"
          />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredOperations.map((op) => {
              const inChain = isInChain(op.code);
              const compatible = isCompatible(op);
              const prereqsMet = prerequisitesMet(op);
              const disabled = inChain || !compatible || !prereqsMet;

              let tooltip = "";
              if (inChain) tooltip = "Already in chain";
              else if (!compatible)
                tooltip = "Incompatible with current operations";
              else if (!prereqsMet)
                tooltip = `Requires: ${op.prerequisites_json.join(", ")}`;

              return (
                <div
                  key={op.code}
                  className={`p-2 border rounded cursor-pointer hover:bg-gray-50 ${
                    disabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => !disabled && addOperation(op)}
                  title={tooltip}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{op.name}</div>
                      <div className="text-xs text-gray-500">{op.code}</div>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {op.process}
                    </span>
                  </div>
                  {op.description && (
                    <p className="text-xs text-gray-600 mt-1">
                      {op.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Chain */}
        <div className="border rounded p-4">
          <h4 className="font-semibold mb-2">
            Current Chain ({localSteps.length})
          </h4>
          {localSteps.length === 0 ? (
            <p className="text-gray-500 text-sm">No operations selected</p>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="chain-steps">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {localSteps.map((step, index) => (
                      <Draggable
                        key={step.operation_code}
                        draggableId={step.operation_code}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="p-3 bg-white border rounded shadow-sm"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono bg-gray-200 px-1 rounded">
                                    {step.sequence}
                                  </span>
                                  <span className="font-medium">
                                    {step.operation_name}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {step.operation_code}
                                </div>
                                {step.cost_cents !== undefined && (
                                  <div className="text-xs text-green-600 mt-1">
                                    ${(step.cost_cents / 100).toFixed(2)} • +
                                    {step.lead_days} days
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  removeOperation(step.operation_code)
                                }
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Summary */}
          {chain && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Finish Cost:</span>
                  <span className="font-semibold">
                    ${(chain.total_cost_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Added Lead Time:</span>
                  <span className="font-semibold">
                    +{chain.added_lead_days} days
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
