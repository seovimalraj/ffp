import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success";

interface ToastProps {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

export function toast({ title, description, variant = "default" }: ToastProps) {
  const toastImpl =
    variant === "destructive"
      ? sonnerToast.error
      : variant === "success"
        ? sonnerToast.success
        : sonnerToast;

  const message = title ?? description ?? "";
  const options = title && description ? { description } : undefined;

  return toastImpl(message, options);
}

export function useToast() {
  return { toast };
}
