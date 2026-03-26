"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import { useMetaStore } from "@/components/store/title-store";
import {
  Meta,
  SectionTitle,
  StatusPill,
} from "@/app/portal/orders/[orderId]/page";
import { RFQKanban } from "@/app/portal/orders/[orderId]/components/RFQKanban";
import Documents from "@/app/portal/orders/[orderId]/components/documents";
import RfqSideDrawer from "@/app/portal/orders/[orderId]/components/rfq-side-drawer";
import { OrderTimelineView } from "@/app/portal/orders/[orderId]/components/OrderTimelineView";
import { LayoutGrid, List } from "lucide-react";
import {
  OrderStatusHistoryProvider,
  useOrderStatusHistory,
} from "@/context/OrderStatusHistoryContext";

/* =======================
   TYPES (FROM API)
======================= */

export type RequestType = {
  id: string;
  order_id: string;
  supplier_id: string;
  part_id: string;
  status_to: string;
  status_from: string;
  comments: string;
  approved_by: string;
  reject_reason: string;
  status: string;
  created_at: string;
};

export type IOrderFull = {
  rfq: {
    rfq_code: string;
    status: string;
    final_price: number;
  };
  order: {
    id: string;
    order_code: string;
    created_at: string;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    payment_status: string;
    status: string;
    address_snapshot: {
      name: string;
      email: string;
      phone: string;
      phoneExt: string;
      street1: string;
      street2?: string;
      city: string;
      zip: string;
      country: string;
    };
  };
  parts: Array<{
    order_part_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    lead_time: number;
    lead_time_type: string;
    drawings_2d: Array<{
      file_name: string;
      file_url: string;
      mime_type: string;
    }>;
    status: string;
    order_part_code: string;
    rfq_part: {
      file_name: string;
      material: string;
      finish: string;
      tolerance: string;
      inspection: string;
      notes: string;
      cad_file_url: string;
      snapshot_2d_url: string | null;
    };
  }>;
  shipping: {
    shipping_information: {
      service: string;
      method: string;
      accountNumber?: string;
    };
    tracking_number?: string;
  };
  requests: Record<string, RequestType>;
};

/* =======================
   PAGE
======================= */

type Tab = "general" | "workflow" | "documents";

export default function OrderPage() {
  const params = useParams();
  const orderId = (params?.orderId as string) || "";
  const [data, setData] = useState<IOrderFull>();
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const response = await apiClient.get(`/orders/${orderId}`);
        setData(response.data);
      } catch (error) {
        console.error(error);
        if (!silent) setLoading(false);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <CustomLoader />
      </div>
    );
  }

  if (!data) {
    return <div>Order not found</div>;
  }

  return (
    <OrderStatusHistoryProvider orderId={orderId} parts={data.parts}>
      <SupplierOrderInner
        data={data}
        orderId={orderId}
        onRefresh={() => fetchData(true)}
      />
    </OrderStatusHistoryProvider>
  );
}

function SupplierOrderInner({
  data,
  orderId,
  onRefresh,
}: {
  data: IOrderFull;
  orderId: string;
  onRefresh: () => void;
}) {
  const { openHistory } = useOrderStatusHistory();
  const searchParams = useSearchParams();
  const searchQuery = (searchParams?.get("tab") as Tab) || "general";
  const [activeTab, setActiveTab] = useState<Tab>(searchQuery);
  const [selectedPart, setSelectedPart] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "timeline">("timeline");
  const { setPageTitle, resetTitle } = useMetaStore();
  const router = useRouter();

  const setUrlParam = (tab: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("tab", tab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    return newUrl;
  };

  useEffect(() => {
    setPageTitle("Order");
    return () => {
      resetTitle();
    };
  }, [data.order.order_code, setPageTitle, resetTitle]);

  return (
    <div className="relative max-w-7xl h-full mx-auto px-2 py-3 space-y-10">
      {/* HEADER */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {data.order.order_code}
          </h1>
          <StatusPill status={data.order.status} />
        </div>
      </div>
      {/* TABS */}
      <div className="border-b flex items-center justify-between text-sm">
        <div className="flex gap-6">
          {["general", "workflow", "documents"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab as any);
                router.push(setUrlParam(tab));
              }}
              className={`pb-3 capitalize transition-all duration-200 ${
                activeTab === tab
                  ? "border-b-2 border-indigo-600 text-indigo-600 font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "workflow" && (
          <div className="flex items-center bg-slate-100 p-1 rounded-lg mb-2 mr-1">
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all ${
                viewMode === "timeline"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <List className="w-3 h-3" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all ${
                viewMode === "kanban"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Kanban</span>
            </button>
          </div>
        )}
      </div>
      {/* PARTS TAB */}
      {activeTab === "general" && (
        <section className="space-y-6">
          {/* Meta Data */}
          <section className="space-y-2">
            <SectionTitle title="Meta Data" />
            <div className=" grid grid-cols-2 items-center gap-6 bg-white border rounded-lg p-4 text-sm space-y-2">
              <Meta label="RFQ" value={data.rfq.rfq_code} />
              <Meta
                label="Created"
                value={new Date(data.order.created_at).toLocaleDateString()}
              />
              <Meta label="Items" value={data.parts.length.toString()} />
            </div>
          </section>

          {/* PART CARDS */}
          <section className="space-y-4">
            <SectionTitle title="Line Items" />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.parts.map((part) => (
                <button
                  key={part.order_part_id}
                  onClick={() => openHistory(part.order_part_id)}
                  className="group relative flex w-full bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-indigo-400/50 transition-all duration-300 text-left items-stretch"
                >
                  {/* Left: Image / Snapshot */}
                  <div className="w-32 bg-slate-50 border-r border-slate-100 p-4 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50/30 transition-colors">
                    {part.rfq_part.snapshot_2d_url ? (
                      <img
                        src={part.rfq_part.snapshot_2d_url}
                        alt="Part snapshot"
                        className="w-full h-full object-contain mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Right: Content */}
                  <div className="flex-1 p-4 flex flex-col justify-between gap-3 min-w-0">
                    <div className="space-y-2">
                      <div className="font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors text-base">
                        {part.rfq_part.file_name}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {part.rfq_part.material}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {part.rfq_part.finish}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 mt-auto">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Qty
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                          {part.quantity}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>
      )}
      {/* WORKFLOW */}
      {activeTab === "workflow" && (
        <div className="pt-2">
          {viewMode === "kanban" ? (
            <RFQKanban
              orderId={orderId}
              parts={data.parts}
              requests={data.requests}
              onRefresh={onRefresh}
              onItemClick={(part: any) => setSelectedPart(part)}
            />
          ) : (
            <OrderTimelineView
              orderId={orderId}
              parts={data.parts}
              onRefresh={onRefresh}
              requests={data.requests}
              onItemClick={(part) => setSelectedPart(part)}
              onStatusClick={(partId, statusFrom) =>
                openHistory(partId, statusFrom)
              }
            />
          )}
        </div>
      )}
      {/* DOCUMENTS */}
      {activeTab === "documents" && (
        <Documents orderId={orderId} inView={activeTab === "documents"} />
      )}
      {/* SIDE DRAWER */}
      {selectedPart && (
        <RfqSideDrawer
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
        />
      )}
    </div>
  );
}
