"use client";

import { useRef, useState } from "react";
import SteppedModal from "../ui/modal/SteppedModal";
import Step from "../ui/modal/step";
import { FormField, Input, Textarea } from "../ui/form-field";
import { Building2, Upload, Loader2, Image as ImageIcon, X } from "lucide-react";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const createSupplierSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  organizationAddress: z.string().optional(),
  organizationLogoUrl: z.string().optional(),
  contactName: z.string().min(1, "Full name is required"),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().optional(),
});

type CreateSupplierFormValues = z.infer<typeof createSupplierSchema>;

interface CreateSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSupplierFormValues) => Promise<void>;
}

const STEPS = [
  { id: 1, title: "Organization Details" },
  { id: 2, title: "Primary Contact" },
];

export function CreateSupplierModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateSupplierModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger,
    formState: { errors },
  } = useForm<CreateSupplierFormValues>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      organizationName: "",
      organizationAddress: "",
      organizationLogoUrl: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
    mode: "onChange",
  });

  const logoUrl = watch("organizationLogoUrl");

  const { upload, isUploading } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const result = await upload(file);
      setValue("organizationLogoUrl", result.url, { shouldValidate: true });
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeLogo = () => {
    setValue("organizationLogoUrl", "", { shouldValidate: true });
  };

  const validateStep = async (step: number) => {
    if (step === 1) {
      const isStepValid = await trigger([
        "organizationName",
        "organizationAddress",
        "organizationLogoUrl",
      ]);
      return isStepValid;
    }
    if (step === 2) {
      const isStepValid = await trigger([
        "contactName",
        "contactEmail",
        "contactPhone",
      ]);
      return isStepValid;
    }
    return true;
  };

  const handleFormSubmit = async (data: CreateSupplierFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      reset();
      onClose();
    } catch (error) {
      console.error("Failed to create supplier:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
    reset(); // reset form when closing without submitting
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Supplier"
      subtitle="Complete the form to register a new supplier to the network."
      icon={<Building2 size={20} className="text-white" />}
      steps={STEPS}
      onValidateStep={validateStep}
      onSubmit={handleSubmit(handleFormSubmit)}
      submitLabel="Create Supplier"
      isLoading={isSubmitting || isUploading}
    >
      {({ currentStep }) => (
        <>
          <Step step={1} currentStep={currentStep}>
            <div className="space-y-4">
              <Controller
                control={control}
                name="organizationName"
                render={({ field }) => (
                  <FormField
                    label="Organization Name"
                    required
                    error={errors.organizationName?.message}
                  >
                    <Input
                      {...field}
                      placeholder="Ex: Precision Machining Co."
                      disabled={isSubmitting}
                      error={!!errors.organizationName}
                    />
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="organizationAddress"
                render={({ field }) => (
                  <FormField
                    label="Organization Address"
                    error={errors.organizationAddress?.message}
                  >
                    <Textarea
                      {...field}
                      placeholder="Street, City, State, Zip..."
                      className="h-24"
                      disabled={isSubmitting}
                      error={!!errors.organizationAddress}
                    />
                  </FormField>
                )}
              />

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <ImageIcon size={14} />
                  Organization Logo
                </label>

                {logoUrl ? (
                  <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-100 rounded-lg group">
                    <div className="w-12 h-12 rounded bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        Logo Uploaded
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSubmitting}
                    className="w-full flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                    ) : (
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-2" />
                    )}
                    <span className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">
                      {isUploading
                        ? "Uploading..."
                        : "Click to upload company logo"}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      Preferably a square image (JPG, PNG)
                    </span>
                  </button>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>
          </Step>

          <Step step={2} currentStep={currentStep}>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg mb-2">
                <p className="text-sm text-blue-800">
                  This contact will be the primary administrator for the supplier
                  portal and will receive the initial login instructions.
                </p>
              </div>

              <Controller
                control={control}
                name="contactName"
                render={({ field }) => (
                  <FormField
                    label="Full Name"
                    required
                    error={errors.contactName?.message}
                  >
                    <Input
                      {...field}
                      placeholder="Ex: John Doe"
                      disabled={isSubmitting}
                      error={!!errors.contactName}
                    />
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="contactEmail"
                render={({ field }) => (
                  <FormField
                    label="Email Address"
                    required
                    error={errors.contactEmail?.message}
                  >
                    <Input
                      {...field}
                      type="email"
                      placeholder="Ex: john@precision.com"
                      disabled={isSubmitting}
                      error={!!errors.contactEmail}
                    />
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="contactPhone"
                render={({ field }) => (
                  <FormField
                    label="Phone Number"
                    hint="We'll use this if we need to contact the supplier urgently."
                    error={errors.contactPhone?.message}
                  >
                    <PhoneInput
                      international
                      defaultCountry="US"
                      value={field.value}
                      onChange={(val) => field.onChange(val || "")}
                      disabled={isSubmitting}
                      className={
                        "flex w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-neutral-900 transition-all duration-150 outline-none focus-within:ring-2 focus-within:ring-neutral-900/10 dark:focus-within:ring-white/10 [&>input]:w-full [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-neutral-900 dark:[&>input]:text-neutral-100 [&>input]:placeholder-neutral-400 dark:[&>input]:placeholder-neutral-500 " +
                        (errors.contactPhone
                          ? "border-red-400 dark:border-red-600 focus-within:border-red-500"
                          : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 focus-within:border-neutral-900 dark:focus-within:border-white")
                      }
                    />
                  </FormField>
                )}
              />
            </div>
          </Step>
        </>
      )}
    </SteppedModal>
  );
}
