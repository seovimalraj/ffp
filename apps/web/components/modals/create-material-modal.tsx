"use client";

import { useEffect, useState } from "react";
import { Package2 } from "lucide-react";
import { z } from "zod";
import SteppedModal from "../ui/modal/SteppedModal";
import {
  FormField,
  Input,
  Select,
  Textarea,
  RadioGroup,
} from "../ui/form-field";
import Step from "../ui/modal/step";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";

const materialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  stock_prices: z.object({
    block: z.number().min(0, "Block price must be positive"),
    bar: z.number().min(0, "Bar price must be positive"),
    plate: z.number().min(0, "Plate price must be positive"),
  }),
  unit: z.string(),
  status: z.enum(["active", "inactive"]),
  currency: z.string(),
});

type MaterialFormData = z.infer<typeof materialSchema>;

interface MaterialModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const STEPS = [
  { id: 1, title: "Details" },
  { id: 2, title: "Pricing" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "INR", label: "INR" },
  { value: "EUR", label: "EUR" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const UNIT_OPTIONS = [{ value: "kg", label: "kg" }];

interface UnitTagProps {
  currency: string;
  unit: string;
}

export function UnitTag({ currency, unit }: UnitTagProps) {
  return (
    <span className="text-xs uppercase font-medium px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
      {currency}
      <span className="lowercase"> per </span>
      {unit}
    </span>
  );
}

export default function MaterialModal({
  isOpen,
  onClose,
  onSuccess,
}: MaterialModalProps) {
  const [formData, setFormData] = useState<MaterialFormData>({
    name: "",
    code: "",
    category: "",
    description: "",
    stock_prices: {
      block: 0,
      bar: 0,
      plate: 0,
    },
    unit: "kg",
    status: "active",
    currency: "USD",
  });

  const [categories, setCategories] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);

  const [errors, setErrors] = useState<
    Partial<Record<keyof MaterialFormData, string>>
  >({});

  useEffect(() => {
    async function fetchCategories() {
      try {
        setIsCategoryLoading(true);
        const response = await apiClient.get("/materials/category");
        const data =
          response.data.categories?.map(
            (category: { id: string; name: string }) => ({
              value: category.id,
              label: category.name,
            }),
          ) || [];
        console.log(data);
        setCategories(data);
      } catch (error) {
        console.error(error);
        notify.error("Error fetching categories");
        // Fallback to default categories if API fails
      } finally {
        setIsCategoryLoading(false);
      }
    }

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      const fieldsToValidate: (keyof MaterialFormData)[] = [
        "name",
        "code",
        "category",
      ];
      const partialSchema = materialSchema.pick(
        Object.fromEntries(fieldsToValidate.map((f) => [f, true])) as Record<
          keyof MaterialFormData,
          true
        >,
      );
      const result = partialSchema.safeParse(formData);

      if (!result.success) {
        const newErrors: Partial<Record<keyof MaterialFormData, string>> = {};
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof MaterialFormData;
          newErrors[field] = issue.message;
        });
        setErrors(newErrors);
        return false;
      }
    } else if (step === 2) {
      const result = materialSchema.shape.stock_prices.safeParse(
        formData.stock_prices,
      );
      if (!result.success) {
        const newErrors: Partial<Record<string, string>> = {};
        result.error.issues.forEach((issue) => {
          const field = `stock_prices.${String(issue.path[0])}`;
          newErrors[field] = issue.message;
        });
        setErrors(newErrors as Partial<Record<keyof MaterialFormData, string>>);
        return false;
      }
    }

    setErrors({});
    return true;
  };

  const handleFieldChange = (
    name: keyof MaterialFormData,
    value: string | number,
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async () => {
    try {
      console.log(formData, "<-- formdata");
      const response = await apiClient.post("/materials", formData);
      console.log(response);
      if (response.status === 201) {
        onSuccess();
        notify.success("Material created successfully");
        onClose();
      } else {
        notify.error("Error creating material");
      }
    } catch (error) {
      console.error(error);
      notify.error("Error creating material");
    }
  };

  const handleStockPriceChange = (
    type: "block" | "bar" | "plate",
    value: number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      stock_prices: {
        ...prev.stock_prices,
        [type]: value,
      },
    }));
  };

  const handleClose = () => {
    setFormData({
      name: "",
      code: "",
      category: "",
      description: "",
      stock_prices: {
        block: 0,
        bar: 0,
        plate: 0,
      },
      unit: "kg",
      status: "active",
      currency: "USD",
    });
    setErrors({});
    onClose();
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Material"
      subtitle="Add a new material to catalog"
      icon={<Package2 size={20} className="text-white dark:text-neutral-900" />}
      steps={STEPS}
      onSubmit={handleSubmit}
      onValidateStep={validateStep}
      submitLabel="Create Material"
      isLoading={isCategoryLoading}
    >
      {({ currentStep }) => (
        <>
          <Step step={1} currentStep={currentStep}>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Name"
                  error={errors.name}
                  required
                  hint="Display name for the material"
                >
                  <Input
                    value={formData.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="e.g., Aluminum 6061"
                    error={!!errors.name}
                  />
                </FormField>

                <FormField
                  label="Code"
                  error={errors.code}
                  required
                  hint="Unique identifier code"
                >
                  <Input
                    value={formData.code}
                    onChange={(e) => handleFieldChange("code", e.target.value)}
                    placeholder="e.g., MAT-001"
                    error={!!errors.code}
                  />
                </FormField>
              </div>

              <FormField
                label="Category"
                error={errors.category}
                required
                hint="Material classification type"
              >
                <Select
                  value={formData.category}
                  onChange={(e) =>
                    handleFieldChange("category", e.target.value)
                  }
                  options={[
                    { value: "", label: "Select a category" },
                    ...categories,
                  ]}
                />
              </FormField>

              <FormField
                label="Description"
                hint="Additional details about the material"
              >
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  placeholder="Enter material description..."
                  rows={3}
                />
              </FormField>

              <FormField
                label="Status"
                hint="Whether this material is available for use"
              >
                <RadioGroup
                  name="status"
                  value={formData.status}
                  onChange={(val) => handleFieldChange("status", val)}
                  options={STATUS_OPTIONS}
                />
              </FormField>
            </div>
          </Step>

          <Step step={2} currentStep={currentStep}>
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Stock Material Price
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                  Set pricing for different stock forms of this material
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm text-neutral-600 dark:text-neutral-400">
                      Block
                    </span>
                    <Input
                      type="number"
                      value={formData.stock_prices.block}
                      onChange={(e) =>
                        handleStockPriceChange(
                          "block",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="flex-1"
                    />
                    <UnitTag
                      currency={formData.currency}
                      unit={formData.unit}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm text-neutral-600 dark:text-neutral-400">
                      Bar
                    </span>
                    <Input
                      type="number"
                      value={formData.stock_prices.bar}
                      onChange={(e) =>
                        handleStockPriceChange(
                          "bar",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="flex-1"
                    />
                    <UnitTag
                      currency={formData.currency}
                      unit={formData.unit}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm text-neutral-600 dark:text-neutral-400">
                      Plate
                    </span>
                    <Input
                      type="number"
                      value={formData.stock_prices.plate}
                      onChange={(e) =>
                        handleStockPriceChange(
                          "plate",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="flex-1"
                    />
                    <UnitTag
                      currency={formData.currency}
                      unit={formData.unit}
                    />
                  </div>
                </div>
              </div>

              <FormField
                label="Unit"
                hint="Unit of measurement for pricing (per kg)"
              >
                <Select
                  value={formData.unit}
                  onChange={(e) => handleFieldChange("unit", e.target.value)}
                  options={UNIT_OPTIONS}
                  disabled
                />
              </FormField>

              <FormField label="Currency" hint="Currency used for all pricing">
                <Select
                  value={formData.currency}
                  onChange={(e) =>
                    handleFieldChange("currency", e.target.value)
                  }
                  options={CURRENCY_OPTIONS}
                  disabled
                />
              </FormField>
            </div>
          </Step>
        </>
      )}
    </SteppedModal>
  );
}
