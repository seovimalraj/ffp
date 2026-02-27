"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CubeIcon } from "@heroicons/react/24/outline";
import { apiClient } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { useMetaStore } from "@/components/store/title-store";
import { motion } from "framer-motion";
import { cn, handleDownload } from "@/lib/utils";
import ExpandFileModal from "@/app/quote-config/components/expand-file-modal";

interface BasePart {
  rfq_id: string;
  rfq: {
    rfq_code: string;
    users: { name: string; id: string };
    organizations: { name: string };
  };
  snapshot_2d_url: string;
  cad_file_url: string;
  file_name: string;
  created_at: string;
}

interface ActivePart extends BasePart {
  status: string;
}

interface AbandonedPart extends BasePart {
  abandoned_reason: string;
  abandoned_at: string;
}

type TabType = "active" | "abandoned";

export default function AdminPartsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [parts, setParts] = useState<(ActivePart | AbandonedPart)[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams?.get("tab") as TabType) || "active",
  );
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 20,
    total: 0,
    hasMore: false,
  });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { setPageTitle, resetTitle } = useMetaStore();

  useEffect(() => {
    setPageTitle("Parts Management");
    return () => resetTitle();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", activeTab);
    router.replace(`?${params.toString()}`, { scroll: false });
    fetchData(0);
  }, [activeTab]);

  const fetchData = async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const endpoint =
        activeTab === "active" ? "/admin/parts" : "/admin/abandoned-rfq-parts";
      const response = await apiClient.get(endpoint, {
        params: { limit: 20, offset },
      });

      const { data, pagination: pag } = response.data;

      setParts((prev) => (append ? [...prev, ...data] : data));

      setPagination({
        offset: pag.offset,
        limit: pag.limit,
        total: pag.total,
        hasMore: pag.hasMore,
      });
    } catch (error) {
      console.error("Failed to fetch parts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (pagination.hasMore && !loading) {
      fetchData(pagination.offset + pagination.limit, true);
    }
  };

  const columns: Column<ActivePart | AbandonedPart>[] = [
    {
      key: "snapshot_2d_url",
      header: "Preview",
      render: (row) => (
        <div
          onClick={() => setSelectedFile(row.cad_file_url)}
          className="relative w-12 h-12 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center p-1 overflow-hidden group/thumb transition-transform hover:scale-105"
        >
          {row.snapshot_2d_url ? (
            <img
              src={row.snapshot_2d_url}
              className="w-full h-full object-contain"
              alt={row.file_name}
            />
          ) : (
            <CubeIcon className="w-6 h-6 text-gray-400" />
          )}
        </div>
      ),
    },
    {
      key: "file_name",
      header: "File Name",
      render: (row) => (
        <span
          className="font-medium text-sm block max-w-[200px] truncate"
          title={row.file_name}
        >
          {row.file_name}
        </span>
      ),
    },
    {
      key: "rfq",
      header: "RFQ / Organization",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-blue-600 text-sm">
            {row.rfq?.rfq_code || "N/A"}
          </span>
          <span className="text-xs text-gray-500">
            {row.rfq?.organizations?.name || ""} | {row.rfq?.users?.name || ""}
          </span>
        </div>
      ),
    },
    ...(activeTab === "active"
      ? [
          {
            key: "status",
            header: "Status",
            render: (row: any) => (
              <Badge variant="outline" className="capitalize">
                {row.status?.replace("_", " ") || "Pending"}
              </Badge>
            ),
          },
        ]
      : [
          {
            key: "abandoned_reason",
            header: "Reason",
            render: (row: any) => (
              <span
                className="text-xs text-red-500 max-w-[200px] truncate block"
                title={row.abandoned_reason}
              >
                {row.abandoned_reason || "Not specified"}
              </span>
            ),
          },
        ]),
    {
      key: "created_at",
      header: activeTab === "active" ? "Created" : "Abandoned At",
      render: (row: any) =>
        formatDate(activeTab === "active" ? row.created_at : row.abandoned_at),
    },
  ];

  return (
    <div className="min-h-screen space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
        <div className="flex items-center gap-1 p-1 bg-gray-100/50 dark:bg-gray-800/40 rounded-xl relative border border-gray-200/50 dark:border-gray-700/50 w-full sm:w-auto overflow-x-auto">
          {(["active", "abandoned"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-8 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 capitalize whitespace-nowrap",
                activeTab === tab
                  ? "text-white dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
              )}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="active-tab-parts"
                  className="absolute inset-0 bg-gray-900 dark:bg-white rounded-[8px] shadow-lg"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{tab} Parts</span>
            </button>
          ))}
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/40 px-6 py-2 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Total {activeTab}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {pagination.total}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm animate-in fade-in duration-500">
        <DataTable
          columns={columns}
          data={parts}
          keyExtractor={(row) =>
            `${row.rfq_id}-${row.file_name}-${row.created_at}`
          }
          isLoading={loading && parts.length === 0}
          hasMore={pagination.hasMore}
          onEndReached={handleLoadMore}
          emptyMessage={`No ${activeTab} parts found.`}
          numbering={true}
          actions={[
            {
              label: "Download",
              onClick: (part) =>
                handleDownload(part.cad_file_url, part.file_name),
            },
          ]}
        />
        {loading && parts.length > 0 && (
          <div className="py-4 text-center">
            <Skeleton className="h-8 w-24 mx-auto rounded-full" />
          </div>
        )}
      </div>

      {selectedFile && (
        <ExpandFileModal
          expandedFile={selectedFile}
          setExpandedFile={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
