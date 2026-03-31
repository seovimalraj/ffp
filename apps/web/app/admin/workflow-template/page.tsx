"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useMetaStore } from "@/components/store/title-store";
import { DataTable, Column } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ClipboardDocumentListIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { GitBranch, Edit2Icon } from "lucide-react";
import { CreateWorkflowTemplateModal } from "@/components/modals/create-workflow-template-modal";
import { EditWorkflowTemplateModal } from "@/components/modals/edit-workflow-template-modal";

export type IWorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
};

const WorkflowTemplatesPage = () => {
  const [templates, setTemplates] = useState<IWorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const { setPageTitle, resetTitle } = useMetaStore();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/order-workflows/templates");
      // The API returns { data: [...], success: true }
      setTemplates(response.data.data || []);
    } catch (error) {
      console.error("Error fetching workflow templates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    setPageTitle("Workflow Templates");
    return () => {
      resetTitle();
    };
  }, [setPageTitle, resetTitle]);

  const columns: Column<IWorkflowTemplate>[] = [
    {
      key: "name",
      header: "Template Name",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {row.name}
          </span>
          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-tight">
            {row.id}
          </span>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xs">
          {row.description || "No description"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              row.is_active ? "bg-green-500" : "bg-gray-400",
            )}
          />
          <span className="capitalize text-sm font-medium">
            {row.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-violet-500" />
            Workflow Templates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage dynamic order workflow structures and phases
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="h-9 px-4 bg-violet-600 hover:bg-violet-700 text-white transition-all flex items-center gap-2 font-semibold text-xs tracking-wide uppercase"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Template</span>
          </Button>
        </div>
      </div>

      <div className="mx-auto">
        {loading ? (
          <div className="space-y-4 mt-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="w-[30%] h-[20px]" />
                <Skeleton className="w-[40%] h-[20px]" />
                <Skeleton className="w-[30%] h-[20px]" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-900/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
            <ClipboardDocumentListIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No templates found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto text-sm">
              Create your first workflow template to start managing order phases
              dynamically.
            </p>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(true)}
              className="font-bold text-xs uppercase tracking-widest px-8"
            >
              Add Template
            </Button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <DataTable
              columns={columns}
              data={templates}
              keyExtractor={(m) => m.id}
              emptyMessage="No Templates Found"
              isLoading={loading}
              numbering={true}
              actions={[
                {
                  label: "View & Edit Phases",
                  icon: <Edit2Icon className="w-4 h-4" />,
                  onClick: (temp) => {
                    setSelectedTemplateId(temp.id);
                    setIsEditModalOpen(true);
                  },
                },
              ]}
            />
          </div>
        )}
      </div>

      <CreateWorkflowTemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTemplates}
      />

      <EditWorkflowTemplateModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTemplateId(null);
        }}
        templateId={selectedTemplateId}
        onSuccess={fetchTemplates}
      />
    </div>
  );
};

export default WorkflowTemplatesPage;
