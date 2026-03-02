"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { DataTable, Column, Action } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { notify } from "@/lib/toast";
import { PlusIcon, PencilIcon, TrashIcon, NewspaperIcon } from "lucide-react";
import BlogModal from "./components/blog-modal";

interface Blog {
  id: string;
  title: string;
  description: string;
  link: string;
  tag: string;
  image_url: string;
  showcase: boolean;
  created_at: string;
}

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 10,
    total: 0,
    hasMore: false,
  });

  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    setPageTitle("Blog Management");
    return () => resetTitle();
  }, [setPageTitle, resetTitle]);

  const fetchBlogs = async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const response = await apiClient.get("/portal/dashboard/blogs", {
        params: { limit: pagination.limit, offset },
      });

      const { data, pagination: pag } = response.data;
      setBlogs((prev) => (append ? [...prev, ...data] : data));
      setPagination({
        offset: pag.offset,
        limit: pag.limit,
        total: pag.total,
        hasMore: pag.hasMore,
      });
    } catch (error) {
      console.error("Failed to fetch blogs:", error);
      notify.error("Failed to fetch blogs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleCreate = () => {
    setEditingBlog(null);
    setIsModalOpen(true);
  };

  const handleEdit = (blog: Blog) => {
    setEditingBlog(blog);
    setIsModalOpen(true);
  };

  const handleDelete = async (blog: Blog) => {
    if (!window.confirm(`Are you sure you want to delete "${blog.title}"?`))
      return;

    try {
      await apiClient.delete(`/portal/dashboard/blogs/${blog.id}`);
      notify.success("Blog deleted successfully");
      fetchBlogs();
    } catch (error) {
      console.error("Failed to delete blog:", error);
      notify.error("Failed to delete blog");
    }
  };

  const columns: Column<Blog>[] = [
    {
      key: "image_url",
      header: "Preview",
      render: (row) => (
        <div className="relative w-16 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {row.image_url ? (
            <img
              src={row.image_url}
              alt={row.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <NewspaperIcon className="w-5 h-5 text-neutral-400" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div className="flex flex-col max-w-xs xl:max-w-md">
          <span
            className="font-semibold text-neutral-900 dark:text-neutral-100 truncate"
            title={row.title}
          >
            {row.title}
          </span>
          <span
            className="text-xs text-neutral-500 truncate"
            title={row.description}
          >
            {row.description}
          </span>
          <span className="text-xs text-neutral-500 truncate" title={row.tag}>
            {row.tag}
          </span>
        </div>
      ),
    },
    {
      key: "showcase",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${row.showcase ? "bg-emerald-500" : "bg-neutral-300"}`}
          />
          <span className="text-sm">
            {row.showcase ? "Showcase" : "Hidden"}
          </span>
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Published",
      render: (row) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {formatDate(row.created_at)}
        </span>
      ),
    },
  ];

  const actions: Action<Blog>[] = [
    {
      label: "View Link",
      onClick: (row) => window.open(row.link, "_blank"),
    },
    {
      label: "Edit",
      icon: <PencilIcon className="w-4 h-4" />,
      onClick: handleEdit,
    },
    {
      label: "Delete",
      icon: <TrashIcon className="w-4 h-4" />,
      className: "text-red-600",
      onClick: handleDelete,
    },
  ];

  return (
    <div className="min-h-screen space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Blogs
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage blog posts displayed in the explore section.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-bold shadow-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Upload Blog</span>
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={blogs}
          keyExtractor={(row) => row.id}
          isLoading={loading && blogs.length === 0}
          actions={actions}
          emptyMessage="No blogs found. Start by uploading one."
          onEndReached={() =>
            pagination.hasMore &&
            fetchBlogs(pagination.offset + pagination.limit, true)
          }
          hasMore={pagination.hasMore}
          numbering={true}
        />
      </div>

      <BlogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchBlogs()}
        blog={editingBlog}
      />
    </div>
  );
}
