"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { z } from "zod";
import SteppedModal from "../ui/modal/SteppedModal";
import { FormField, Input, Select, RadioGroup } from "../ui/form-field";
import Step from "../ui/modal/step";
import { notify } from "@/lib/toast";
import { apiClient } from "@/lib/api";

const stockSchema = z.object({
  material: z.string().min(1, "Material is required"),
  warehouse: z.string().min(1, "Warehouse is required"),
  current_stock: z.number().min(0, "Current quantity must be positive"),
  max_stock: z.number().min(0, "Max stock must be positive"),
  stock_unit: z.string(),
  supplier_price: z.number().min(0, "Supplier price must be positive"),
  currency: z.string(),
  status: z.enum(["active", "inactive"]),
});

type StockFormData = z.infer<typeof stockSchema>;

interface StockModalProps {
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

// const STOCK_MATERIAL_OPTIONS = [
//   { value: "rod", label: "Rod" },
//   { value: "block", label: "Block" },
//   { value: "plate", label: "Plate" },
// ];

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

export default function CreateSupplierMaterialModal({
  isOpen,
  onClose,
  onSuccess,
}: StockModalProps) {
  const [formData, setFormData] = useState<StockFormData>({
    material: "",
    warehouse: "",
    current_stock: 0,
    max_stock: 0,
    stock_unit: "kg",
    supplier_price: 0,
    currency: "USD",
    status: "active",
  });

  const [materials, setMaterials] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [warehouses, setWarehouses] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof StockFormData, string>>
  >({});

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);

        // Fetch materials
        const materialsResponse = await apiClient.get("/materials/minimal");
        const materialsData =
          materialsResponse.data.materials?.map(
            (material: { id: string; name: string }) => ({
              value: material.id,
              label: material.name,
            }),
          ) || [];
        setMaterials(materialsData);

        // Fetch warehouses
        const warehousesResponse = await apiClient.get("/supplier/warehouses");
        const warehousesData =
          warehousesResponse.data.warehouses?.map(
            (warehouse: { id: string; name: string }) => ({
              value: warehouse.id,
              label: warehouse.name,
            }),
          ) || [];
        setWarehouses(warehousesData);
      } catch (error) {
        console.error(error);
        notify.error("Error fetching data");
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      const fieldsToValidate: (keyof StockFormData)[] = [
        "material",
        "warehouse",
      ];
      const partialSchema = stockSchema.pick(
        Object.fromEntries(fieldsToValidate.map((f) => [f, true])) as Record<
          keyof StockFormData,
          true
        >,
      );
      const result = partialSchema.safeParse(formData);

      if (!result.success) {
        const newErrors: Partial<Record<keyof StockFormData, string>> = {};
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof StockFormData;
          newErrors[field] = issue.message;
        });
        setErrors(newErrors);
        return false;
      }
    } else if (step === 2) {
      const fieldsToValidate: (keyof StockFormData)[] = [
        "current_stock",
        "max_stock",
        "supplier_price",
      ];
      const partialSchema = stockSchema.pick(
        Object.fromEntries(fieldsToValidate.map((f) => [f, true])) as Record<
          keyof StockFormData,
          true
        >,
      );
      const result = partialSchema.safeParse(formData);

      if (!result.success) {
        const newErrors: Partial<Record<keyof StockFormData, string>> = {};
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof StockFormData;
          newErrors[field] = issue.message;
        });
        setErrors(newErrors);
        return false;
      }
    }

    setErrors({});
    return true;
  };

  const handleFieldChange = (
    name: keyof StockFormData,
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
      const response = await apiClient.post("/supplier/material", formData);
      console.log(response);
      if (response.status === 201) {
        onSuccess();
        notify.success("Stock created successfully");
        onClose();
      } else {
        notify.error("Error creating stock");
      }
    } catch (error) {
      console.error(error);
      notify.error("Error creating stock");
    }
  };

  const handleClose = () => {
    setFormData({
      material: "",
      warehouse: "",
      current_stock: 0,
      max_stock: 0,
      stock_unit: "kg",
      supplier_price: 0,
      currency: "USD",
      status: "active",
    });
    setErrors({});
    onClose();
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Stock"
      subtitle="Add a new stock entry to inventory"
      icon={<Package size={20} className="text-white dark:text-neutral-900" />}
      steps={STEPS}
      onSubmit={handleSubmit}
      onValidateStep={validateStep}
      submitLabel="Create Stock"
      isLoading={isLoading}
    >
      {({ currentStep }) => (
        <>
          <Step step={1} currentStep={currentStep}>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Material"
                  error={errors.material}
                  required
                  hint="Select the material type"
                >
                  <Select
                    value={formData.material}
                    onChange={(e) =>
                      handleFieldChange("material", e.target.value)
                    }
                    options={[
                      { value: "", label: "Select a material" },
                      ...materials,
                    ]}
                    error={!!errors.material}
                  />
                </FormField>

                <FormField
                  label="Warehouse"
                  error={errors.warehouse}
                  required
                  hint="Select storage location"
                >
                  <Select
                    value={formData.warehouse}
                    onChange={(e) =>
                      handleFieldChange("warehouse", e.target.value)
                    }
                    options={[
                      { value: "", label: "Select a warehouse" },
                      ...warehouses,
                    ]}
                    error={!!errors.warehouse}
                  />
                </FormField>
              </div>

              <FormField
                label="Status"
                hint="Whether this stock is available for use"
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
              <FormField
                label="Current Quantity"
                error={errors.current_stock}
                required
                hint="Current available quantity"
              >
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={formData.current_stock}
                    onChange={(e) =>
                      handleFieldChange(
                        "current_stock",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    error={!!errors.current_stock}
                    className="flex-1"
                  />
                  <span className="text-xs uppercase font-medium px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                    {formData.stock_unit}
                  </span>
                </div>
              </FormField>

              <FormField
                label="Max Stock"
                error={errors.max_stock}
                required
                hint="Maximum stock capacity"
              >
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={formData.max_stock}
                    onChange={(e) =>
                      handleFieldChange(
                        "max_stock",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    error={!!errors.max_stock}
                    className="flex-1"
                  />
                  <span className="text-xs uppercase font-medium px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                    {formData.stock_unit}
                  </span>
                </div>
              </FormField>

              <FormField label="Stock Unit" hint="Unit of measurement (per kg)">
                <Select
                  value={formData.stock_unit}
                  onChange={(e) =>
                    handleFieldChange("stock_unit", e.target.value)
                  }
                  options={UNIT_OPTIONS}
                  disabled
                />
              </FormField>

              <FormField
                label="Supplier Price"
                error={errors.supplier_price}
                required
                hint="Price from supplier"
              >
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={formData.supplier_price}
                    onChange={(e) =>
                      handleFieldChange(
                        "supplier_price",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    error={!!errors.supplier_price}
                    className="flex-1"
                  />
                  <UnitTag
                    currency={formData.currency}
                    unit={formData.stock_unit}
                  />
                </div>
              </FormField>

              <FormField label="Currency" hint="Currency used for pricing">
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
