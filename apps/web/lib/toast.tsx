import toast, { Toast } from "react-hot-toast";
import { ToastCard } from "@/components/ui/Toast/toast-card";

const options: Partial<Pick<Toast, "id" | "icon" | "duration" | "ariaProps" | "className" | "style" | "position" | "iconTheme" | "toasterId" | "removeDelay">> = {
  position: "top-right",
  duration: 10000
}

export const notify = {
  success(msg: string, desc?: string, toastId?: string) {
    return toast.custom((t) => (
      <ToastCard title={msg} message={desc} type="success" onClose={() => toast.dismiss(t.id)} autoClose={false} />
    ), { ...options, id: toastId });
  },
  error(msg: string, desc?: string, toastId?: string) {
    return toast.custom((t) => (
      <ToastCard title={msg} message={desc} type="error" onClose={() => toast.dismiss(t.id)} autoClose={false} />
    ), { ...options, id: toastId });
  },
  info(msg: string, desc?: string, toastId?: string) {
    return toast.custom((t) => (
      <ToastCard title={msg} message={desc} type="info" onClose={() => toast.dismiss(t.id)} autoClose={false} />
    ), { ...options, id: toastId });
  },
  loading(msg: string, desc?: string, toastId?: string) {
    return toast.custom((t) => (
      <ToastCard title={msg} message={desc} type="loading" onClose={() => toast.dismiss(t.id)} autoClose={false} />
    ), { ...options, duration: Infinity, id: toastId });
  },
  dismiss(toastId?: string) {
    toast.dismiss(toastId);
  }
};
