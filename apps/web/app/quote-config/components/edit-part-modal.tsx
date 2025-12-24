import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CadViewer } from "@/components/cad/cad-viewer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  PartConfig,
  MaterialItem,
  ToleranceItem,
  FinishItem,
  InspectionItem,
  ThreadItem,
} from "@/types/part-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import DFMAnalysis from "./dfm-analysis";

interface EditPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculatePrice: (
    part: PartConfig,
    leadTimeType: PartConfig["leadTimeType"],
  ) => number;
  part: PartConfig;
  index: number;
  updatePart: (
    index: number,
    field: keyof PartConfig,
    value: any,
    saveToDb?: boolean,
  ) => void;
  updatePartFields?: (
    index: number,
    updates: Partial<PartConfig>,
    saveToDb?: boolean,
  ) => void;
  MATERIALS_LIST: MaterialItem[];
  TOLERANCES_LIST: ToleranceItem[];
  FINISHES_LIST: FinishItem[];
  THREAD_OPTIONS: ThreadItem[];
  INSPECTIONS_OPTIONS: InspectionItem[];
}

export const CERTIFICATES_LIST = [
  {
    value: "itar_ear",
    label: "ITAR / EAR Registration",
    description:
      "U.S. export control compliance for defense-related manufacturing.",
    category: "Compliance",
  },
  {
    value: "cmmc",
    label: "CMMC",
    description:
      "Cybersecurity Maturity Model Certification required for DoD programs.",
    category: "Cybersecurity",
  },
  {
    value: "iso_9001",
    label: "ISO 9001",
    description: "Quality management system certification.",
    category: "Quality",
  },
  {
    value: "as9100",
    label: "AS9100",
    description: "Aerospace quality management standard.",
    category: "Aerospace",
  },
  {
    value: "hardware_cert",
    label: "Hardware Certification",
    description: "Certification for regulated or safety-critical hardware.",
    category: "Quality",
  },
  {
    value: "coc",
    label: "Certificate of Conformance",
    description: "Confirms parts meet specified requirements.",
    category: "Documentation",
  },
  {
    value: "material_traceability",
    label: "Material Traceability",
    description: "Full traceability of raw materials to source.",
    category: "Materials",
  },
  {
    value: "jcp_ejcp",
    label: "JCP / eJCP",
    description: "U.S. DoD Joint Certification Program compliance.",
    category: "Defense",
  },
  {
    value: "material_cert",
    label: "Material Certification",
    description: "Mill certificates verifying material composition.",
    category: "Materials",
  },
] as const;

export function EditPartModal({
  isOpen,
  onClose,
  part,
  index,
  updatePart,
  MATERIALS_LIST,
  TOLERANCES_LIST,
  FINISHES_LIST,
  THREAD_OPTIONS,
  INSPECTIONS_OPTIONS,
  calculatePrice,
  updatePartFields,
}: EditPartModalProps) {
  const [activeTab, setActiveTab] = useState("config");
  const [localPart, setLocalPart] = useState<PartConfig>(part);

  useEffect(() => {
    if (isOpen) {
      setLocalPart(part);
    }
  }, [isOpen, part]);

  const updateLocalPart = (field: keyof PartConfig, value: any) => {
    setLocalPart((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (updatePartFields) {
      const updates: Partial<PartConfig> = {};
      const keys = Object.keys(localPart) as (keyof PartConfig)[];
      keys.forEach((key) => {
        if (localPart[key] !== part[key]) {
          // @ts-expect-error dynamic key assignment not safely typed
          updates[key] = localPart[key];
        }
      });
      if (Object.keys(updates).length > 0) {
        updatePartFields(index, updates);
      }
    } else {
      const keys = Object.keys(localPart) as (keyof PartConfig)[];
      keys.forEach((key) => {
        if (localPart[key] !== part[key]) {
          updatePart(index, key, localPart[key]);
        }
      });
    }
    onClose();
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setLocalPart((prev) => ({
        ...prev,
        fileObject: acceptedFiles[0],
        fileName: acceptedFiles[0].name,
      }));
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "model/stl": [".stl"],
      "model/step": [".step", ".stp"],
      "application/octet-stream": [".stl", ".step", ".stp"],
    },
    multiple: false,
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 flex flex-col bg-white overflow-hidden shadow-2xl rounded-xl">
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Visualizer (40%) */}
          <div className="w-[40%] bg-gray-50/50 border-r p-2 border-gray-100 flex flex-col group">
            <div className="h-[calc(100%-86px)] p-4">
              <CadViewer
                file={localPart.fileObject || localPart.filePath}
                className="w-full rounded-2xl"
                showControls={false}
                zoom={0.8}
              />
            </div>

            {/* Overlay Dropzone */}
            <div
              {...getRootProps()}
              className="border h-[86px] border-dashed border-slate-200 rounded-lg p-8 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer text-center group flex flex-col items-center justify-center gap-3"
            >
              <input {...getInputProps()} />
              <div className="p-2 bg-white rounded-full border border-slate-200 shadow-sm group-hover:border-blue-300">
                <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
              </div>
              <p className="text-xs font-medium text-slate-600 group-hover:text-blue-700 transition-colors">
                Revise CAD Model <br />
                <span className="text-slate-400 font-normal">
                  (STL, STEP, STP, IGS, OBJ and More - Single file supported)
                </span>
              </p>
            </div>
          </div>

          {/* Right Panel: Configuration (60%) */}
          <div className="flex-1 flex flex-col bg-white">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col h-full"
            >
              <div className="px-8 pt-6 border-b border-gray-100">
                <TabsList className="bg-transparent p-0 gap-6 h-auto">
                  <TabsTrigger
                    value="config"
                    className="
                      px-0 py-2 rounded-none border-b-2 border-transparent 
                      data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 
                      data-[state=active]:bg-transparent data-[state=active]:shadow-none
                      text-gray-500 hover:text-gray-800 transition-all font-medium text-sm
                    "
                  >
                    Specifications
                  </TabsTrigger>
                  <TabsTrigger
                    value="analysis"
                    className="
                      px-0 py-2 rounded-none border-b-2 border-transparent 
                      data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 
                      data-[state=active]:bg-transparent data-[state=active]:shadow-none
                      text-gray-500 hover:text-gray-800 transition-all font-medium text-sm
                    "
                  >
                    DFM Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Specifications Tab */}
              <TabsContent
                value="config"
                className="flex-1 overflow-y-auto outline-none"
              >
                <div className="px-8 py-8 max-w-4xl">
                  {/* Quantity & Pricing */}
                  <div className="space-y-10 mb-10">
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Quantity Breakdown
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Adjust quantity and view volume discounts.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {/* Quantity row */}
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm font-medium text-gray-700">
                            Quantity
                          </label>

                          <Input
                            type="number"
                            min={1}
                            value={localPart.quantity}
                            onChange={(e) =>
                              updateLocalPart(
                                "quantity",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="w-28 h-10 border-gray-200 bg-white rounded-lg shadow-sm text-sm"
                          />
                        </div>

                        {/* Savings row */}
                        {localPart.quantity > 1 && (
                          <div className="pl-20">
                            <p className="text-sm font-medium text-green-600">
                              You save{" "}
                              {formatCurrency(
                                calculatePrice(
                                  { ...localPart, quantity: 1 },
                                  localPart.leadTimeType,
                                ) *
                                  localPart.quantity -
                                  calculatePrice(
                                    localPart,
                                    localPart.leadTimeType,
                                  ),
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="border col-span-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Qty</th>
                              <th className="px-4 py-3 font-semibold">
                                Unit Price
                              </th>
                              <th className="px-4 py-3 font-semibold">
                                Subtotal
                              </th>
                              <th className="px-4 py-3 font-semibold text-green-600">
                                You Save
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {[1, 5, 10, 25, 50, 100, 200, 300, 400, 500].map(
                              (qty) => {
                                const total = calculatePrice(
                                  { ...localPart, quantity: qty },
                                  localPart.leadTimeType,
                                );
                                const unit = total / qty;
                                const baseTotal = calculatePrice(
                                  { ...localPart, quantity: 1 },
                                  localPart.leadTimeType,
                                );
                                const baseUnit = baseTotal / 1;
                                const savings = baseUnit * qty - total;
                                const isCurrent = localPart.quantity === qty;

                                return (
                                  <tr
                                    key={qty}
                                    className={`
                                      transition-colors cursor-pointer 
                                      ${isCurrent ? "bg-green-50 ring-1 ring-inset ring-green-500/20" : "hover:bg-gray-50"}
                                    `}
                                    onClick={() =>
                                      updateLocalPart("quantity", qty)
                                    }
                                  >
                                    <td className="px-4 py-3 font-bold text-gray-900">
                                      {qty}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                      {formatCurrency(unit)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900 font-semibold">
                                      {formatCurrency(total)}
                                    </td>
                                    <td className="px-4 py-3 text-green-600 font-medium">
                                      {savings > 0.01
                                        ? formatCurrency(savings)
                                        : "-"}
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100 w-full mb-10" />

                  {/* General Config Section */}
                  <div className="space-y-10">
                    {/* Material */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Material
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Select the specific material grade required for this
                          part's manufacturing.
                        </p>
                      </div>
                      <Select
                        value={localPart.material}
                        onValueChange={(v) => updateLocalPart("material", v)}
                      >
                        <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                          <SelectValue placeholder="Select Material" />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIALS_LIST.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Finish */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Surface Finish
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Choose the post-processing surface finish or coating.
                        </p>
                      </div>
                      <Select
                        value={localPart.finish}
                        onValueChange={(v) => updateLocalPart("finish", v)}
                      >
                        <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                          <SelectValue placeholder="Select Finish" />
                        </SelectTrigger>
                        <SelectContent>
                          {FINISHES_LIST.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              <div className="flex justify-between items-center w-full min-w-[200px]">
                                <span>{f.label}</span>
                                {f.cost > 0 && (
                                  <span className="text-xs text-gray-500">
                                    +${f.cost}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Treads & Inserts */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Threads & Inserts
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Specify if standard or custom threading inserts are
                          required.
                        </p>
                      </div>
                      <Select
                        value={localPart.threads}
                        onValueChange={(v) => updateLocalPart("threads", v)}
                      >
                        <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          {THREAD_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Tolerances */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Tolerance Standard
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Define the required dimensional accuracy for this
                          part.
                        </p>
                      </div>
                      <div className="grid lg:grid-cols-3 gap-3">
                        {TOLERANCES_LIST.map((t) => (
                          <div
                            key={t.value}
                            onClick={() =>
                              updateLocalPart("tolerance", t.value)
                            }
                            className={`
                              cursor-pointer rounded-xl p-4 border transition-all text-center
                              ${
                                localPart.tolerance === t.value
                                  ? "border-blue-600 bg-blue-600 text-white shadow-lg"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                              }
                            `}
                          >
                            <span className="font-semibold last:col-span-2 lg:last:col-span-1 text-sm">
                              {t.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Inspection */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Inspection Report
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Select the level of quality control and reporting
                          needed.
                        </p>
                      </div>
                      <Select
                        value={localPart.inspection}
                        onValueChange={(v) => updateLocalPart("inspection", v)}
                      >
                        <SelectTrigger className="h-12 border-gray-200 bg-white hover:border-gray-300 transition-colors rounded-xl shadow-sm text-base">
                          <SelectValue placeholder="Standard" />
                        </SelectTrigger>
                        <SelectContent>
                          {INSPECTIONS_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    {/* Notes */}
                    <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
                      <div>
                        <Label className="text-base font-semibold text-gray-900">
                          Engineering Notes
                        </Label>
                        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                          Add specific instructions, critical dimensions, or
                          request technical review.
                        </p>
                      </div>
                      <textarea
                        className="
                          w-full min-h-[160px] p-4 text-sm rounded-xl border border-gray-200 
                          bg-white focus:border-black focus:ring-1 focus:ring-black outline-none 
                          resize-none placeholder:text-gray-400 shadow-sm transition-all
                        "
                        value={localPart.notes}
                        onChange={(e) =>
                          updateLocalPart("notes", e.target.value)
                        }
                        placeholder="e.g. Critical dimension at X axis, please mask threads before coating..."
                      />
                    </div>

                    {/* Certification */}
                    <div className="grid lg:grid-cols-[260px_1fr] gap-10 items-start">
                      {/* Left description */}
                      <div className="space-y-2">
                        <Label className="text-base font-semibold text-gray-900">
                          Certification
                        </Label>
                        <p className="text-sm text-gray-500 leading-relaxed max-w-[220px]">
                          Select the certifications required for this part.
                        </p>
                      </div>

                      {/* Right options */}
                      <div className="grid lg:grid-cols-2 gap-4">
                        {CERTIFICATES_LIST.map((c) => {
                          const isChecked = localPart?.certificates?.includes(
                            c.value,
                          );

                          return (
                            <div
                              key={c.value}
                              onClick={() =>
                                updateLocalPart(
                                  "certificates",
                                  isChecked
                                    ? localPart?.certificates?.filter(
                                        (v) => v !== c.value,
                                      )
                                    : [
                                        ...(localPart?.certificates || []),
                                        c.value,
                                      ],
                                )
                              }
                              className={`
                                group flex items-start gap-3 rounded-xl border p-4 text-left transition-all
                                focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                ${
                                  isChecked
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                                } 
                              `}
                            >
                              <Checkbox
                                checked={isChecked}
                                className={`
                                mt-0.5
                                ${
                                  isChecked
                                    ? "border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                                    : "border-gray-300"
                                }
                              `}
                              />

                              <div className="space-y-0.5">
                                <span
                                  className={`
                                    text-sm font-semibold
                                    ${isChecked ? "text-blue-700" : "text-gray-800"}
                                  `}
                                >
                                  {c.label}
                                </span>
                                {c.description && (
                                  <p className="text-xs text-gray-500 leading-snug">
                                    {c.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />
                  </div>
                </div>
              </TabsContent>

              {/* Analysis Tab */}
              <TabsContent
                value="analysis"
                className="flex-1 overflow-hidden outline-none bg-gray-50/50 h-full"
              >
                <div className="h-full w-full">
                  <DFMAnalysis part={localPart} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Clean Header */}
        <div className="flex items-center justify-between px-8 py-6 border-t border-gray-100 bg-white z-20">
          <div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              {localPart.fileName}
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              Configure part specifications and requirements
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm text-gray-500">Current Price</span>
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(
                  calculatePrice(localPart, localPart.leadTimeType),
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 text-white hover:bg-gray-800 rounded-lg px-6"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
