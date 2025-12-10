import { useState, useMemo } from "react";
import SteppedModal from "../ui/modal/SteppedModal";
import { z } from "zod";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import {
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Step from "../ui/modal/step";
import { FormField, Input } from "../ui/form-field";

const addStockSchema = z.object({
  stock: z
    .number()
    .min(1, { message: "Stock must be greater than 0" })
    .max(1000000, {
      message: "Stock is too large. Please enter a realistic quantity.",
    }),
});

type AddStockFormData = z.infer<typeof addStockSchema>;

type MaterialPropType = {
  material_id: string;
  stock_unit: string;
  max_stock: number;
  warehouse: string;
  current_stock: number;
};

interface StockAddModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
  materialData: MaterialPropType;
}

const STEPS = [{ id: 1, title: "Add Stock Quantity" }];

const INITIAL_STATE: AddStockFormData = {
  stock: 0,
};

const AddStockModal = ({
  isOpen,
  onSuccess,
  onClose,
  materialData,
}: StockAddModalProps) => {
  const [formdata, setFormdata] = useState<AddStockFormData>(INITIAL_STATE);

  const [errors, setErrors] = useState<
    Partial<Record<keyof AddStockFormData, string>>
  >({});

  // Calculate stock metrics
  const stockMetrics = useMemo(() => {
    const currentStock = materialData.current_stock;
    const maxStock = materialData.max_stock;
    const addedStock = formdata.stock || 0;
    const newStock = currentStock + addedStock;
    const currentPercentage = (currentStock / maxStock) * 100;
    const newPercentage = (newStock / maxStock) * 100;
    const availableCapacity = maxStock - currentStock;
    const willExceed = newStock > maxStock;

    return {
      currentStock,
      maxStock,
      addedStock,
      newStock,
      currentPercentage,
      newPercentage,
      availableCapacity,
      willExceed,
    };
  }, [materialData, formdata.stock]);

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      const result = addStockSchema.safeParse(formdata);
      if (!result.success) {
        const newErrors: Partial<Record<keyof AddStockFormData, string>> = {};
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof AddStockFormData;
          newErrors[field] = issue.message;
        });
        setErrors(newErrors);
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const handleFieldChange = (name: keyof AddStockFormData, value: string) => {
    const parsedValue = value.trim() === "" ? 0 : Number(value);

    setFormdata((prev) => ({
      ...prev,
      [name]: isNaN(parsedValue) ? 0 : parsedValue,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async () => {
    try {
      if (
        formdata.stock + materialData.current_stock >
        materialData.max_stock
      ) {
        notify.error(
          `Stock limit exceeded. Max allowed: ${materialData.max_stock} ${materialData.stock_unit}`,
        );
        return;
      }

      const response = await apiClient.post(`/supplier/warehouses/${materialData.warehouse}/add-stocks`, {
        supplierMaterialId: materialData.material_id,
        quantity: formdata.stock,
      });

      if (response.data.success) {
        notify.success("Stock updated successfully");
        onSuccess();
        onClose();
      } else {
        notify.error("Unable to update stock. Please try again.");
      }
    } catch (error) {
      console.error(error);
      notify.error("Unexpected error occurred while updating stock.");
    }
  };

  const handleClose = () => {
    setFormdata(INITIAL_STATE);
    setErrors({});
    onClose();
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Stock"
      subtitle={`Increase available stock for this material`}
      icon={<Package size={20} className="text-white dark:text-neutral-900" />}
      steps={STEPS}
      onSubmit={handleSubmit}
      onValidateStep={validateStep}
      submitLabel="Update Stock"
    >
      {({ currentStep }) => (
        <Step step={1} currentStep={currentStep}>
          <div className="space-y-6">
            {/* Current Status Card */}
            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-neutral-900 dark:to-neutral-800 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Current Inventory Status
                  </h3>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-sm">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Current Stock
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {materialData.current_stock.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {materialData.stock_unit}
                  </p>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Max Capacity
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {materialData.max_stock.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {materialData.stock_unit}
                  </p>
                </div>
              </div>

              {/* Current Stock Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Stock Level
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stockMetrics.currentPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stockMetrics.currentPercentage <= 20
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(stockMetrics.currentPercentage, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Add Stock Input */}
            <FormField
              label="Quantity to Add"
              error={errors.stock}
              required
              hint={`Available capacity: ${stockMetrics.availableCapacity.toLocaleString()} ${materialData.stock_unit}`}
            >
              <div className="relative">
                <Input
                  type="number"
                  value={formdata.stock || ""}
                  onChange={(e) => handleFieldChange("stock", e.target.value)}
                  placeholder={`Enter quantity (${materialData.stock_unit})`}
                  error={!!errors.stock}
                  className="pr-20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {materialData.stock_unit}
                </div>
              </div>
            </FormField>

            {/* Preview Card - Only show when stock is entered */}
            {formdata.stock > 0 && (
              <div
                className={`rounded-lg border-2 p-5 transition-all ${
                  stockMetrics.willExceed
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                    : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  {stockMetrics.willExceed ? (
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4
                      className={`text-sm font-semibold mb-1 ${
                        stockMetrics.willExceed
                          ? "text-red-900 dark:text-red-200"
                          : "text-emerald-900 dark:text-emerald-200"
                      }`}
                    >
                      {stockMetrics.willExceed
                        ? "Capacity Exceeded"
                        : "Stock Update Preview"}
                    </h4>
                    <p
                      className={`text-xs ${
                        stockMetrics.willExceed
                          ? "text-red-700 dark:text-red-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {stockMetrics.willExceed
                        ? `This will exceed max capacity by ${(stockMetrics.newStock - stockMetrics.maxStock).toLocaleString()} ${materialData.stock_unit}`
                        : "New stock level will be within capacity"}
                    </p>
                  </div>
                </div>

                {/* Stock Change Visualization */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Current
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {stockMetrics.currentStock.toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      New Total
                    </p>
                    <p
                      className={`text-xl font-bold ${
                        stockMetrics.willExceed
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {stockMetrics.newStock.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Capacity
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {stockMetrics.maxStock.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* New Stock Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span
                      className={
                        stockMetrics.willExceed
                          ? "text-red-700 dark:text-red-300"
                          : "text-emerald-700 dark:text-emerald-300"
                      }
                    >
                      New Stock Level
                    </span>
                    <span
                      className={`font-semibold ${
                        stockMetrics.willExceed
                          ? "text-red-900 dark:text-red-200"
                          : "text-emerald-900 dark:text-emerald-200"
                      }`}
                    >
                      {stockMetrics.newPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        stockMetrics.willExceed
                          ? "bg-red-500"
                          : stockMetrics.newPercentage <= 50
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(stockMetrics.newPercentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Increase Indicator */}
                {!stockMetrics.willExceed && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      Increasing by {stockMetrics.addedStock.toLocaleString()}{" "}
                      {materialData.stock_unit} (
                      {(
                        (stockMetrics.addedStock / stockMetrics.maxStock) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Step>
      )}
    </SteppedModal>
  );
};

export default AddStockModal;
