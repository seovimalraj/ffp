"use client";

import { useEffect, useState } from "react";
import {
  VerticalSteppedModal,
  Step,
  StepContainer,
} from "@/components/ui/modal/VerticalSteppedModal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CNC_MATERIALS,
  SHEET_METAL_MATERIALS,
  CNC_FINISHES,
  SHEET_METAL_FINISHES,
  CNC_TOLERANCES,
  SHEET_METAL_THICKNESSES,
  isSheetMetalProcess,
} from "@/lib/pricing-engine";
import { Checkbox } from "@/components/ui/checkbox";

const CERTIFICATES_LIST = [
  {
    value: "itar_ear",
    label: "ITAR / EAR Registration",
    description:
      "U.S. export control compliance for defense-related manufacturing.",
    category: "Compliance",
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
    value: "material_cert",
    label: "Material Certification",
    description: "Mill certificates verifying material composition.",
    category: "Materials",
  },
] as const;

interface EditPartSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  part: any;
  onSave: (updatedFields: any) => void;
  isSaving: boolean;
}

export default function EditPartSpecsModal({
  isOpen,
  onClose,
  part,
  onSave,
  isSaving,
}: EditPartSpecsModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Local state for all fields
  const [process, setProcess] = useState(part?.process || "cnc-machining");
  const [material, setMaterial] = useState(part?.material || "");
  const [finish, setFinish] = useState(part?.finish || "as-machined");
  const [tolerance, setTolerance] = useState(part?.tolerance || "standard");
  const [thickness, setThickness] = useState(
    part?.sheet_thickness_mm?.toString() || "1.0",
  );
  const [quantity, setQuantity] = useState(part?.quantity || 1);
  const [inspection, setInspection] = useState(part?.inspection || "Standard");
  const [notes, setNotes] = useState(part?.notes || "");
  const [certificates, setCertificates] = useState<string[]>(
    part?.certificates || [],
  );

  useEffect(() => {
    if (part) {
      setProcess(
        part.process ||
          (isSheetMetalProcess(part.process) ? "sheet-metal" : "cnc-machining"),
      );
      setMaterial(part.material || "");
      setFinish(part.finish || "as-machined");
      setTolerance(part.tolerance || "standard");
      setThickness(part.sheet_thickness_mm?.toString() || "1.0");
      setQuantity(part.quantity || 1);
      setInspection(part.inspection || "Standard");
      setNotes(part.notes || "");
      setCertificates(part.certificates || []);
    }
  }, [part]);

  const steps: Step[] = [
    {
      id: "process-material",
      title: "Process & Material",
      description: "Core manufacturing details",
    },
    {
      id: "finish-spec",
      title: "Finish & Inspection",
      description: "Post-processing & Quality",
    },
    {
      id: "quantity-notes",
      title: "Quantity & Notes",
      description: "Final adjustments",
    },
  ];

  const handleSave = () => {
    onSave({
      process,
      material,
      finish,
      tolerance,
      sheet_thickness_mm: parseFloat(thickness),
      quantity,
      inspection,
      notes,
      certificates,
    });
  };

  const toggleCertificate = (certValue: string) => {
    setCertificates((prev) =>
      prev.includes(certValue)
        ? prev.filter((c) => c !== certValue)
        : [...prev, certValue],
    );
  };

  const isSM = isSheetMetalProcess(process);

  return (
    <VerticalSteppedModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Specifications: ${part?.file_name}`}
      steps={steps}
      currentStep={currentStep}
      onStepChange={(step) => setCurrentStep(step)}
      onSubmit={handleSave}
      submitLabel="Update Specifications"
      isSubmitting={isSaving}
    >
      <div className="space-y-6 py-2">
        <StepContainer stepActive={currentStep === 0}>
          <div className="space-y-6">
            {/* Process Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Manufacturing Process
              </Label>
              <Select value={process} onValueChange={setProcess}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select Process" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cnc-machining">CNC Machining</SelectItem>
                  <SelectItem value="sheet-metal">
                    Sheet Metal Fabrication
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Material Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Material
              </Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select Material" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {isSM
                    ? Object.entries(SHEET_METAL_MATERIALS).map(
                        ([category, materials]) => (
                          <SelectGroup key={category}>
                            <SelectLabel className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1.5 bg-slate-50">
                              {category.replace(/-/g, " ")}
                            </SelectLabel>
                            {(materials as any[]).map((m: any) => (
                              <SelectItem
                                key={m.code || m.value}
                                value={m.code || m.value}
                              >
                                {m.name || m.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ),
                      )
                    : Object.entries(CNC_MATERIALS).map(
                        ([category, materials]) => (
                          <SelectGroup key={category}>
                            <SelectLabel className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1.5 bg-slate-50">
                              {category}
                            </SelectLabel>
                            {materials.map((m: any) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ),
                      )}
                </SelectContent>
              </Select>
            </div>

            {/* Thickness (SM) or Tolerance (CNC) */}
            {isSM ? (
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Material Thickness (mm)
                </Label>
                <Select value={thickness} onValueChange={setThickness}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Select Thickness" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHEET_METAL_THICKNESSES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Tolerance
                </Label>
                <Select value={tolerance} onValueChange={setTolerance}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Select Tolerance" />
                  </SelectTrigger>
                  <SelectContent>
                    {CNC_TOLERANCES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </StepContainer>

        <StepContainer stepActive={currentStep === 1}>
          <div className="space-y-6">
            {/* Finish */}
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Surface Finish
              </Label>
              <Select value={finish} onValueChange={setFinish}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select Finish" />
                </SelectTrigger>
                <SelectContent>
                  {(isSM
                    ? Object.entries(SHEET_METAL_FINISHES).map(
                        ([v, f]: any) => ({ value: v, label: f.name }),
                      )
                    : (CNC_FINISHES as any)
                  ).map((f: any) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Inspection */}
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Inspection Requirement
              </Label>
              <Select value={inspection} onValueChange={setInspection}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select Inspection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard Inspection</SelectItem>
                  <SelectItem value="CMM">CMM Inspection</SelectItem>
                  <SelectItem value="FAI">
                    First Article Inspection (FAI)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Certifications */}
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Certifications Required
              </Label>
              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto p-1">
                {CERTIFICATES_LIST.map((cert) => (
                  <div
                    key={cert.value}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <Checkbox
                      id={`cert-${cert.value}`}
                      checked={certificates.includes(cert.value)}
                      onCheckedChange={() => toggleCertificate(cert.value)}
                    />
                    <label
                      htmlFor={`cert-${cert.value}`}
                      className="text-sm font-medium text-slate-700 cursor-pointer flex-1"
                    >
                      {cert.label}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {cert.description}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </StepContainer>

        <StepContainer stepActive={currentStep === 2}>
          <div className="space-y-6">
            {/* Quantity */}
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Quantity
              </Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min={1}
                className="h-12 rounded-xl"
              />
            </div>

            {/* Engineering Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Engineering Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add special instructions or engineering requirements here..."
                className="min-h-[150px] rounded-xl"
              />
            </div>
          </div>
        </StepContainer>
      </div>
    </VerticalSteppedModal>
  );
}
