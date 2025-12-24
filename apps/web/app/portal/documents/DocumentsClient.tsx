"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
  EyeIcon,
  CloudArrowDownIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { PDFPreview, FilePreview } from "@/components/ui/file-preview";
import type { Document, Invoice } from "@/types/order";
import { trackEvent } from "@/lib/analytics/posthog";

const ITEMS_PER_PAGE = 20;

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "QAP", label: "QAP" },
  { value: "Certificate", label: "Certificate" },
  { value: "FAIR", label: "FAIR" },
  { value: "Measurement", label: "Measurement" },
  { value: "Invoice", label: "Invoice" },
  { value: "Receipt", label: "Receipt" },
  { value: "CoC", label: "CoC" },
  { value: "MaterialCert", label: "MaterialCert" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Generating", label: "Generating" },
  { value: "Ready", label: "Ready" },
  { value: "Failed", label: "Failed" },
  { value: "Revoked", label: "Revoked" },
];

const LINKED_TYPE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "Quote", label: "Quote" },
  { value: "Order", label: "Order" },
  { value: "Part", label: "Part" },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    linked_type: "any",
    date_from: "",
    date_to: "",
  });
  const [activeTab, setActiveTab] = useState("all");
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string>("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load documents when filters change
  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: ITEMS_PER_PAGE.toString(),
        q: debouncedSearchQuery,
        ...(filters.type !== "all" && { type: filters.type }),
        ...(filters.status !== "all" && { status: filters.status }),
        ...(filters.linked_type !== "any" && {
          linked_type: filters.linked_type,
        }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
      });

      const response = await api.get<{
        documents: Document[];
        total: number;
        page: number;
        page_size: number;
      }>(`/documents?${params}`);

      setDocuments(response.data.documents);
      setTotal(response.data.total);

      trackEvent("docs_list_view", {
        tab: activeTab,
        filters: Object.values(filters).filter(
          (v) => v !== "all" && v !== "any" && v !== "",
        ).length,
        search_query: debouncedSearchQuery || undefined,
      });
    } catch (error: any) {
      toast.error("Failed to load documents");
      console.error("Error loading documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearchQuery, filters, activeTab]);

  // Load invoices for billing tab
  const loadInvoices = useCallback(async () => {
    try {
      const response = await api.get<Invoice[]>("/billing/invoices");
      setInvoices(response.data);
    } catch (error: any) {
      console.error("Error loading invoices:", error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "billing") {
      loadInvoices();
    } else {
      loadDocuments();
    }
  }, [activeTab, loadDocuments, loadInvoices]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // Handle preview
  const handlePreview = async (document: Document) => {
    setPreviewDocument(document);
    setIsPreviewLoading(true);
    try {
      const response = await api.get<{ signed_url: string }>(
        `/files/${document.file_id}/signed-url`,
      );
      setSignedUrl(response.data.signed_url);
      trackEvent("doc_preview_open", {
        document_id: document.id,
        type: document.type,
      });
    } catch (error: any) {
      toast.error("Failed to load preview");
      console.error("Error loading preview:", error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewInvoice = async (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setIsPreviewLoading(true);
    try {
      // For invoices, we need to find the document first
      const invoiceDoc = documents.find(
        (d) => d.linked_id === invoice.order_id && d.type === "Invoice",
      );
      if (invoiceDoc) {
        const response = await api.get<{ signed_url: string }>(
          `/files/${invoiceDoc.file_id}/signed-url`,
        );
        setSignedUrl(response.data.signed_url);
      }
    } catch (error: any) {
      toast.error("Failed to load invoice preview");
      console.error("Error loading invoice preview:", error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle download
  const handleDownload = async (document: Document) => {
    try {
      const response = await api.get<{ signed_url: string }>(
        `/files/${document.file_id}/signed-url`,
      );
      window.open(response.data.signed_url, "_blank");
      trackEvent("doc_download", {
        document_id: document.id,
        type: document.type,
      });
    } catch (error: any) {
      toast.error("Failed to download document");
      console.error("Error downloading document:", error);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      const invoiceDoc = documents.find(
        (d) => d.linked_id === invoice.order_id && d.type === "Invoice",
      );
      if (invoiceDoc) {
        const response = await api.get<{ signed_url: string }>(
          `/files/${invoiceDoc.file_id}/signed-url`,
        );
        window.open(response.data.signed_url, "_blank");
      }
    } catch (error: any) {
      toast.error("Failed to download invoice");
      console.error("Error downloading invoice:", error);
    }
  };

  // Handle regenerate QAP
  const handleRegenerateQAP = async (document: Document) => {
    try {
      await api.post("/qap/documents", {
        order_id: document.linked_id,
        template_id: "default-template", // This would come from the document or be selected
        force: true,
      });
      toast.success("QAP regeneration started");
      trackEvent("qap_generate", {
        document_id: document.id,
        order_id: document.linked_id,
      });
      // Refresh the list
      loadDocuments();
    } catch (error: any) {
      toast.error("Failed to regenerate QAP");
      console.error("Error regenerating QAP:", error);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(filters.type !== "all" && { type: filters.type }),
        ...(filters.status !== "all" && { status: filters.status }),
        ...(filters.linked_type !== "any" && {
          linked_type: filters.linked_type,
        }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
        q: debouncedSearchQuery,
      });

      const response = await fetch(`/api/documents/export.csv?${params}`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "documents-export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast.error("Failed to export documents");
      console.error("Error exporting documents:", error);
    }
  };

  // Handle navigation to linked entity
  const handleNavigateToLinked = (document: Document) => {
    if (document.linked_type === "Order") {
      router.push(`/portal/orders/${document.linked_id}`);
    } else if (document.linked_type === "Quote") {
      router.push(`/portal/quotes/${document.linked_id}`);
    }
  };

  // Helper functions
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const getStatusVariant = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      Draft: "secondary",
      Generating: "default",
      Ready: "default",
      Failed: "destructive",
      Revoked: "outline",
    };
    return variants[status] || "default";
  };

  const getDocumentIcon = (type: string) => {
    const icons: Record<string, any> = {
      QAP: DocumentTextIcon,
      Certificate: DocumentIcon,
      FAIR: DocumentTextIcon,
      Measurement: DocumentTextIcon,
      Invoice: ReceiptPercentIcon,
      Receipt: ReceiptPercentIcon,
      CoC: DocumentIcon,
      MaterialCert: DocumentIcon,
    };
    return icons[type] || DocumentIcon;
  };

  // Filtered documents based on active tab
  const filteredDocuments = useMemo(() => {
    if (activeTab === "all") return documents;
    if (activeTab === "qap") return documents.filter((d) => d.type === "QAP");
    if (activeTab === "certs")
      return documents.filter((d) =>
        ["Certificate", "CoC", "MaterialCert"].includes(d.type),
      );
    if (activeTab === "fair")
      return documents.filter((d) => ["FAIR", "Measurement"].includes(d.type));
    if (activeTab === "billing")
      return documents.filter((d) => ["Invoice", "Receipt"].includes(d.type));
    return documents;
  }, [documents, activeTab]);

  // Pagination
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Button onClick={handleExport} variant="outline">
          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search documents, orders, quotes…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="max-w-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              value={filters.type}
              onValueChange={(value) => handleFilterChange("type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.linked_type}
              onValueChange={(value) =>
                handleFilterChange("linked_type", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any Linked" />
              </SelectTrigger>
              <SelectContent>
                {LINKED_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePickerWithRange
              date={{
                from: filters.date_from
                  ? new Date(filters.date_from)
                  : undefined,
                to: filters.date_to ? new Date(filters.date_to) : undefined,
              }}
              onDateChange={(range) => {
                handleFilterChange(
                  "date_from",
                  range.from?.toISOString().split("T")[0] || "",
                );
                handleFilterChange(
                  "date_to",
                  range.to?.toISOString().split("T")[0] || "",
                );
              }}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Tabs and Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="qap">QAP</TabsTrigger>
          <TabsTrigger value="certs">Certificates</TabsTrigger>
          <TabsTrigger value="fair">FAIR / Measurement</TabsTrigger>
          <TabsTrigger value="billing">Invoices & Receipts</TabsTrigger>
        </TabsList>

        {/* All Documents Tab */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading documents...
                    </TableCell>
                  </TableRow>
                ) : filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2">
                        <p className="text-gray-500">No documents yet</p>
                        <p className="text-sm text-gray-400">
                          Generate a QAP from an Order page.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((document) => {
                    const IconComponent = getDocumentIcon(document.type);
                    return (
                      <TableRow key={document.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <IconComponent className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium">{document.title}</p>
                              <p className="text-sm text-gray-500">
                                {document.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{document.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {document.linked_type} #
                            {document.linked_id.slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell>v{document.version}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(document.status)}>
                            {document.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(document.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(document.updated_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePreview(document)}
                              title="Preview"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(document)}
                              title="Download"
                            >
                              <CloudArrowDownIcon className="w-4 h-4" />
                            </Button>
                            {document.type === "QAP" &&
                              document.status !== "Generating" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRegenerateQAP(document)}
                                  title="Regenerate"
                                >
                                  <ArrowPathIcon className="w-4 h-4" />
                                </Button>
                              )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleNavigateToLinked(document)}
                              title="Open Linked"
                            >
                              <DocumentIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Other tabs use the same table structure */}
        <TabsContent value="qap" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((document) => {
                  const IconComponent = getDocumentIcon(document.type);
                  return (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <IconComponent className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{document.title}</p>
                            <p className="text-sm text-gray-500">
                              {document.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{document.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {document.linked_type} #
                          {document.linked_id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell>v{document.version}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(document.status)}>
                          {document.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(document.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(document.updated_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreview(document)}
                            title="Preview"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(document)}
                            title="Download"
                          >
                            <CloudArrowDownIcon className="w-4 h-4" />
                          </Button>
                          {document.status !== "Generating" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRegenerateQAP(document)}
                              title="Regenerate"
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2">
                        <p className="text-gray-500">No invoices yet</p>
                        <p className="text-sm text-gray-400">
                          Complete checkout to create your first invoice.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono">
                        {invoice.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        Order #{invoice.order_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === "Paid" ? "default" : "secondary"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(invoice.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePreviewInvoice(invoice)}
                            title="View Invoice"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadInvoice(invoice)}
                            title="Download PDF"
                          >
                            <CloudArrowDownIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Other tabs would follow the same pattern */}
        <TabsContent value="certs">
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Certificates tab content would be similar to All tab but filtered
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fair">
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              FAIR / Measurement tab content would be similar to All tab but
              filtered
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && activeTab !== "billing" && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(page * ITEMS_PER_PAGE, total)} of {total} documents
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={!hasPrevPage}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Preview Sheet */}
      <Sheet
        open={!!previewDocument || !!previewInvoice}
        onOpenChange={() => {
          setPreviewDocument(null);
          setPreviewInvoice(null);
          setSignedUrl("");
        }}
      >
        <SheetContent side="right" className="w-[600px] sm:w-[800px]">
          <SheetHeader>
            <SheetTitle>
              {previewDocument
                ? previewDocument.title
                : `Invoice ${previewInvoice?.id.slice(0, 8)}`}
            </SheetTitle>
          </SheetHeader>

          {isPreviewLoading ? (
            <div className="py-8 text-center">Loading preview...</div>
          ) : signedUrl && previewDocument ? (
            <FilePreview
              file={{
                name: previewDocument.title,
                mime:
                  previewDocument.type === "PDF"
                    ? "application/pdf"
                    : "application/octet-stream",
                size: previewDocument.size || 0,
              }}
              signedUrl={signedUrl}
              className="h-[60vh]"
            />
          ) : signedUrl && previewInvoice ? (
            <PDFPreview
              url={signedUrl}
              title={`Invoice ${previewInvoice.id.slice(0, 8)}`}
              className="h-[60vh]"
            />
          ) : (
            <div className="py-8 text-center text-gray-500">
              Preview not available
            </div>
          )}

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setPreviewDocument(null);
                setPreviewInvoice(null);
                setSignedUrl("");
              }}
            >
              Close
            </Button>
            {signedUrl && (
              <Button onClick={() => window.open(signedUrl, "_blank")}>
                <CloudArrowDownIcon className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
