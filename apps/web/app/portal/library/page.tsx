"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  List as ListIcon,
  Files as FilesIcon,
  Folder as FolderIcon,
  Search,
  Filter,
  Download,
  X,
  Trash2,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/data-table";
import { FolderCard } from "@/components/ui/folder-card";
import { FileCard } from "@/components/ui/file-card";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import ExpandFileModal from "@/app/quote-config/components/expand-file-modal";
import { cn } from "@/lib/utils";
import { FloatingActions } from "@/components/ui/floating-actions";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import {
  MakeQuoteModal,
  QuotePart,
} from "@/components/modals/make-quote-modal";
import {
  QuoteSuccessModal,
  CreatedRFQ,
} from "@/components/modals/quote-success-modal";
import { toast } from "sonner";

type RFQPart = {
  id: string;
  rfq_id: string;
  file_name: string;
  cad_file_url: string;
  cad_file_type: string;
  snapshot_2d_url: string;
  status: string;
  material: string;
  quantity: number;
  lead_time: number;
  lead_time_type: string;
  final_price: number;
  rfq: {
    id: string;
    rfq_code: string;
    status: string;
  };
  part_drawing_2d: {
    id: string;
    file_name: string;
    file_url: string;
    mime_type: string;
    created_at: string;
  } | null;
  created_at: string; // Assuming it exists or using drawing date
};

type GroupedRFQ = {
  rfq_id: string;
  rfq_code: string;
  status: string;
  parts: RFQPart[];
  lastUpdated: string;
};

const Page = () => {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [groupBy, setGroupBy] = useState<"file" | "rfq">("rfq");
  const [data, setData] = useState<RFQPart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRfq, setSelectedRfq] = useState<GroupedRFQ | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMakeQuoteModalOpen, setIsMakeQuoteModalOpen] = useState(false);
  const [createdRfqs, setCreatedRfqs] = useState<CreatedRFQ[]>([]);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const selectedPartsList = useMemo(() => {
    return data
      .filter((p) => selectedIds.has(p.id))
      .map(
        (p): QuotePart => ({
          id: p.id,
          file_name: p.file_name,
          snapshot_2d_url: p.snapshot_2d_url,
          material: p.material,
          quantity: p.quantity,
          rfq_code: p.rfq?.rfq_code,
        }),
      );
  }, [data, selectedIds]);

  const handleCreateQuote = async (groups: { parts: string[] }[]) => {
    try {
      const response = await api.post("/rfq/derived", { groups });
      if (response.data.success && response.data.rfqs) {
        setCreatedRfqs(response.data.rfqs);
        setIsMakeQuoteModalOpen(false);
        setIsSuccessModalOpen(true);
        setSelectedIds(new Set());
        fetchFiles(); // Refresh list
      }
    } catch (error) {
      console.error("Error creating quotes:", error);
      toast.error("Failed to create quotes");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  useEffect(() => {
    handleClearSelection();
  }, [groupBy]);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/files/rfq");
      setData(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, GroupedRFQ> = {};
    data.forEach((part) => {
      const rfqId = part.rfq_id;
      if (!groups[rfqId]) {
        groups[rfqId] = {
          rfq_id: rfqId,
          rfq_code: part.rfq?.rfq_code || "Unknown RFQ",
          status: part.rfq?.status || "Draft",
          parts: [],
          lastUpdated:
            part.part_drawing_2d?.created_at || new Date().toISOString(),
        };
      }
      groups[rfqId].parts.push(part);
      if (
        part.part_drawing_2d?.created_at &&
        part.part_drawing_2d.created_at > groups[rfqId].lastUpdated
      ) {
        groups[rfqId].lastUpdated = part.part_drawing_2d.created_at;
      }
    });
    return Object.values(groups);
  }, [data]);

  const filteredParts = useMemo(() => {
    return data.filter(
      (part) =>
        part.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.rfq?.rfq_code.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [data, searchQuery]);

  const filteredGroupedData = useMemo(() => {
    return groupedData.filter(
      (group) =>
        group.rfq_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.parts.some((p) =>
          p.file_name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );
  }, [groupedData, searchQuery]);

  const tableColumns: Column<RFQPart>[] = [
    {
      key: "snapshot_2d",
      header: "Preview",
      render: (row) => (
        <div
          className="flex items-center justify-center"
          onClick={() => setPreviewFile(row.cad_file_url)}
        >
          {row.snapshot_2d_url ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
              <img
                src={row.snapshot_2d_url}
                alt={row.file_name}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center border border-slate-200 dark:border-neutral-700">
              <FilesIcon className="w-6 h-6 text-slate-400" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "file_name",
      header: "File Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-900 dark:text-white">
            {row.file_name}
          </span>
        </div>
      ),
      sortable: true,
    },

    {
      key: "rfq_code",
      header: "RFQ Code",
      render: (row) => (
        <span className="text-slate-600 dark:text-neutral-400">
          {row.rfq?.rfq_code}
        </span>
      ),
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300">
          {row.status}
        </span>
      ),
      sortable: true,
    },
    {
      key: "material",
      header: "Material",
      render: (row) => row.material || "-",
    },
    {
      key: "created_at",
      header: "Upload Date",
      render: (row) =>
        format(
          new Date(row.part_drawing_2d?.created_at || new Date()),
          "MMM d, yyyy",
        ),
      sortable: true,
    },
    {
      key: "actions",
      header: "",
      render: (_row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => window.open(_row.cad_file_url, "_blank")}
            className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 p-6">
      {/* Header section */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Part Library
            </h1>
            <p className="text-slate-500 dark:text-neutral-400 text-lg">
              Manage and organize your project files and RFQs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* View */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                View
              </span>

              <button
                onClick={() => setView("grid")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  view === "grid"
                    ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>

              <button
                onClick={() => setView("table")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  view === "table"
                    ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300",
                )}
              >
                <ListIcon className="h-4 w-4" />
                Table
              </button>
            </div>

            {/* Group By */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Group by
              </span>

              <button
                onClick={() => setGroupBy("file")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  groupBy === "file"
                    ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300",
                )}
              >
                <FilesIcon className="h-4 w-4" />
                Files
              </button>

              <button
                onClick={() => setGroupBy("rfq")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  groupBy === "rfq"
                    ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300",
                )}
              >
                <FolderIcon className="h-4 w-4" />
                RFQs
              </button>
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
                Clear ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search files or RFQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-900 dark:text-white"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all shadow-sm">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Content area */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <CustomLoader />
          </div>
        ) : filteredParts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-slate-300 dark:border-neutral-800">
            <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-full">
              <FilesIcon className="w-8 h-8 text-slate-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                No files found
              </h3>
              <p className="text-slate-500 dark:text-neutral-400">
                Try adjusting your search or filters.
              </p>
            </div>
          </div>
        ) : view === "table" ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DataTable
              columns={tableColumns}
              data={filteredParts}
              keyExtractor={(row) => row.id}
              pageSize={10}
              selectable={true}
              onSelectionChange={(selected) => {
                setSelectedIds(new Set(selected.map((s) => s.id)));
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-16 gap-12 pb-10">
            <AnimatePresence mode="popLayout">
              {groupBy === "rfq"
                ? filteredGroupedData.map((group) => (
                    <motion.div
                      key={group.rfq_id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setSelectedRfq(group)}
                      className="cursor-pointer group"
                    >
                      <FolderCard
                        accentColor={
                          group.status === "Completed" ? "#10b981" : "#7036E9"
                        }
                        className="w-full"
                        isSelected={group.parts.every((part) =>
                          selectedIds.has(part.id),
                        )}
                        onSelect={() => {
                          // Check if all parts are currently selected
                          const allSelected = group.parts.every((part) =>
                            selectedIds.has(part.id),
                          );

                          setSelectedIds((prev) => {
                            const newSet = new Set(prev);
                            if (allSelected) {
                              // Deselect all parts in this RFQ
                              group.parts.forEach((part) => {
                                newSet.delete(part.id);
                              });
                            } else {
                              // Select all parts in this RFQ
                              group.parts.forEach((part) => {
                                newSet.add(part.id);
                              });
                            }
                            return newSet;
                          });
                        }}
                      >
                        {/* Header */}
                        <FolderCard.Header>
                          <div className="flex justify-between gap-6">
                            {/* Left */}
                            <div className="flex flex-col">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                RFQ
                              </span>

                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-extrabold text-slate-900">
                                  {group.rfq_code}
                                </h3>

                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    group.status === "Completed"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : group.status === "Pending"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {group.status}
                                </span>
                              </div>
                            </div>

                            {/* Right */}
                            <div className="text-right">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Files
                              </span>
                              <div className="text-lg font-extrabold text-primary">
                                {group.parts.length}
                              </div>
                            </div>
                          </div>
                        </FolderCard.Header>

                        {/* Meta */}
                        <FolderCard.Meta>
                          Updated{" "}
                          {format(new Date(group.lastUpdated), "MMM d, yyyy")}
                        </FolderCard.Meta>

                        {/* Body */}
                        <FolderCard.Body>
                          <div className="space-y-2 invisible-scrollbar">
                            {group.parts.slice(0, 3).map((part) => (
                              <div
                                key={part.id}
                                className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
                              >
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white border border-slate-200">
                                  <FilesIcon className="h-4 w-4 text-slate-400" />
                                </div>

                                <span className="text-sm font-medium text-slate-700 truncate">
                                  {part.file_name}
                                </span>
                              </div>
                            ))}

                            {group.parts.length > 3 && (
                              <div className="pt-1 text-center text-xs font-medium text-slate-400">
                                +{group.parts.length - 3} more files
                              </div>
                            )}
                          </div>
                        </FolderCard.Body>
                      </FolderCard>
                    </motion.div>
                  ))
                : filteredParts.map((part) => (
                    <motion.div
                      key={part.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <FileCard
                        rfqId={part.rfq_id}
                        partId={part.id}
                        fileName={part.file_name}
                        fileType={part.cad_file_type}
                        thumbnailUrl={part.snapshot_2d_url}
                        cadFileUrl={part.cad_file_url}
                        uploadedAt={
                          part.part_drawing_2d?.created_at ||
                          new Date().toISOString()
                        }
                        onPreview={() => setPreviewFile(part.cad_file_url)}
                        onDownload={() =>
                          window.open(part.cad_file_url, "_blank")
                        }
                        isSelected={selectedIds.has(part.id)}
                        onSelect={() => toggleSelection(part.id)}
                      />
                    </motion.div>
                  ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* RFQ Modal */}
      <AnimatePresence>
        {selectedRfq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRfq(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedRfq.rfq_code}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        selectedRfq.status === "Completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {selectedRfq.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {selectedRfq.parts.length} files in this RFQ
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRfq(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {selectedRfq.parts.map((part) => (
                    <FileCard
                      key={part.id}
                      rfqId={part.rfq_id}
                      partId={part.id}
                      fileName={part.file_name}
                      fileType={part.cad_file_type}
                      thumbnailUrl={part.snapshot_2d_url}
                      cadFileUrl={part.cad_file_url}
                      uploadedAt={
                        part.part_drawing_2d?.created_at ||
                        new Date().toISOString()
                      }
                      onPreview={() => setPreviewFile(part.cad_file_url)}
                      onDownload={() =>
                        window.open(part.cad_file_url, "_blank")
                      }
                      isSelected={selectedIds.has(part.id)}
                      onSelect={() => toggleSelection(part.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="px-8 py-5 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/20 flex justify-end">
                <button
                  onClick={() => setSelectedRfq(null)}
                  className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {previewFile && (
        <ExpandFileModal
          expandedFile={previewFile}
          setExpandedFile={(file) => setPreviewFile(file as string | null)}
        />
      )}

      <FloatingActions
        count={selectedIds.size}
        onClear={handleClearSelection}
        itemLabel="part"
        actions={[
          {
            label: "Make Quote",
            icon: <Download className="w-4 h-4" />,
            variant: "outline",
            onClick: () => setIsMakeQuoteModalOpen(true),
          },
          {
            label: "Single Quote",
            icon: <Zap className="w-4 h-4" />,
            variant: "default",
            onClick: async () => {
              const group = { parts: Array.from(selectedIds) };
              await handleCreateQuote([group]);
            },
          },
          {
            label: "Delete",
            icon: <Trash2 className="w-4 h-4" />,
            variant: "outline",
            onClick: async () => {
              if (confirm("Are you sure you want to delete these items?")) {
                // Implement delete logic here if needed or keep existing placeholder
                // For now just clearing selection as per original code
                handleClearSelection();
              }
            },
          },
        ]}
      />

      <MakeQuoteModal
        isOpen={isMakeQuoteModalOpen}
        onClose={() => setIsMakeQuoteModalOpen(false)}
        parts={selectedPartsList}
        onConfirm={handleCreateQuote}
      />

      <QuoteSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        rfqs={createdRfqs}
      />
    </div>
  );
};

export default Page;
