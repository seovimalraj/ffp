"use client";

import { useState, useEffect } from "react";
import SteppedModal from "@/components/ui/modal/SteppedModal";
import Step from "@/components/ui/modal/step";
import { FormField, Input, Textarea } from "@/components/ui/form-field";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import { z } from "zod";
import { NewspaperIcon, GlobeIcon, ImageIcon, TypeIcon } from "lucide-react";

const blogSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().min(1, "Description is required"),
  link: z.string().url("Must be a valid URL"),
  image_url: z.string().url("Must be a valid image URL"),
  tag: z.string().min(1, "Tag is required"),
  showcase: z.boolean().default(false),
});

type BlogFormData = z.infer<typeof blogSchema>;

interface BlogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  blog: any | null;
}

const STEPS = [{ id: 1, title: "Blog Details" }];

const INITIAL_STATE: BlogFormData = {
  title: "",
  description: "",
  link: "",
  image_url: "",
  tag: "",
  showcase: false,
};

export default function BlogModal({
  isOpen,
  onClose,
  onSuccess,
  blog,
}: BlogModalProps) {
  const [formData, setFormData] = useState<BlogFormData>(INITIAL_STATE);
  const [errors, setErrors] = useState<
    Partial<Record<keyof BlogFormData, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (blog) {
      setFormData({
        title: blog.title || "",
        description: blog.description || "",
        link: blog.link || "",
        tag: blog.tag || "",
        image_url: blog.image_url || "",
        showcase: blog.showcase || false,
      });
    } else {
      setFormData(INITIAL_STATE);
    }
    setErrors({});
  }, [blog, isOpen]);

  const handleChange = (name: keyof BlogFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const result = blogSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: any = {};
      result.error.issues.forEach((issue) => {
        newErrors[issue.path[0]] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      if (blog?.id) {
        await apiClient.patch(`/portal/dashboard/blogs/${blog.id}`, formData);
        notify.success("Blog updated successfully");
      } else {
        await apiClient.post("/portal/dashboard/blogs", formData);
        notify.success("Blog created successfully");
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Blog action failed:", error);
      notify.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={onClose}
      title={blog ? "Edit Blog" : "Upload Blog"}
      subtitle={
        blog
          ? "Update existing blog information"
          : "Add a new blog to the platform"
      }
      icon={
        <NewspaperIcon size={20} className="text-white dark:text-neutral-900" />
      }
      steps={STEPS}
      onSubmit={handleSubmit}
      onValidateStep={() => validate()}
      submitLabel={blog ? "Update Blog" : "Create Blog"}
    >
      {({ currentStep }) => (
        <Step step={1} currentStep={currentStep}>
          <div className="space-y-5 py-2">
            <FormField label="Title" error={errors.title} required>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <TypeIcon size={18} />
                </div>
                <Input
                  className="pl-10"
                  placeholder="e.g. The Future of CNC Machining"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                />
              </div>
            </FormField>

            <FormField label="Description" error={errors.description} required>
              <Textarea
                placeholder="Brief summary of the blog post..."
                className="min-h-[100px]"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </FormField>

            <FormField label="Tag" error={errors.tag} required>
              <Input
                placeholder="Tag for the blog"
                className="min-h-[100px]"
                value={formData.tag}
                onChange={(e) => handleChange("tag", e.target.value)}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Blog URL" error={errors.link} required>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <GlobeIcon size={18} />
                  </div>
                  <Input
                    className="pl-10"
                    placeholder="https://example.com/blog..."
                    value={formData.link}
                    onChange={(e) => handleChange("link", e.target.value)}
                  />
                </div>
              </FormField>

              <FormField label="Image URL" error={errors.image_url} required>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <ImageIcon size={18} />
                  </div>
                  <Input
                    className="pl-10"
                    placeholder="https://images.com/cover.jpg"
                    value={formData.image_url}
                    onChange={(e) => handleChange("image_url", e.target.value)}
                  />
                </div>
              </FormField>
            </div>

            <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-700">
              <input
                type="checkbox"
                id="showcase"
                checked={formData.showcase}
                onChange={(e) => handleChange("showcase", e.target.checked)}
                className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20"
              />
              <div>
                <label
                  htmlFor="showcase"
                  className="text-sm font-bold text-neutral-900 dark:text-white cursor-pointer"
                >
                  Showcase on Dashboard
                </label>
                <p className="text-xs text-neutral-500">
                  If checked, this blog will be visible in the user's dashboard
                  explore section.
                </p>
              </div>
            </div>

            {/* Preview Section */}
            {(formData.title || formData.image_url) && (
              <div className="mt-4">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-2">
                  Live Preview
                </span>
                <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
                  {formData.image_url ? (
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
                      Placeholder for image
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end">
                    <h3 className="text-lg font-bold text-white line-clamp-1">
                      {formData.title || "Blog Title Preview"}
                    </h3>
                    <p className="text-sm text-neutral-200 line-clamp-1">
                      {formData.description ||
                        "Description preview goes here..."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Step>
      )}
    </SteppedModal>
  );
}
