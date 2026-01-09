"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { formatCurrencyGeneric } from "@/lib/format";
import { RFQKanban } from "./components/RFQKanban";
import { generateRandomSlug } from "@/lib/utils";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import RfqSideDrawer from "./components/rfq-side-drawer";
import { CommandBlock } from "@/components/ui/command-block";
import Documents from "./components/documents";

/* =======================
   TYPES (FROM API)
======================= */

export type IOrderFull = {
  rfq: {
    rfq_code: string;
    status: string;
    final_price: number;
  };
  order: {
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
};

/* =======================
   PAGE
======================= */

type Tab = "general" | "workflow" | "documents";

export default function OrderPage() {
  const searchParams = useSearchParams();
  const searchQuery = (searchParams?.get("tab") as Tab) || "general";
  const [activeTab, setActiveTab] = useState<Tab>(searchQuery);

  const params = useParams();
  const orderId = (params?.orderId as string) || "";
  const [selectedPart, setSelectedPart] = useState<any>(null);
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
      <div className="border-b flex gap-6 text-sm">
        {["general", "workflow", "documents"].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab as any);
            }}
            className={`pb-3 capitalize ${
              activeTab === tab
                ? "border-b-2 border-indigo-600 text-indigo-600 font-medium"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
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
              <Meta
                label="Total Value"
                value={formatCurrencyGeneric(data.order.total_amount)}
                strong
              />
            </div>
          </section>
          {/* SHIPPING */}
          <section className="space-y-2">
            <SectionTitle title="Shipping" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AddressCard
                title="Ship To"
                name={data.order.address_snapshot.name}
                address={[
                  data.order.address_snapshot.street1,
                  data.order.address_snapshot.street2,
                  `${data.order.address_snapshot.city} - ${data.order.address_snapshot.zip}`,
                  data.order.address_snapshot.country,
                ]}
              />

              <div className="bg-slate-50 border rounded-lg p-4 text-sm space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Shipping Method
                </div>
                <div className="font-medium text-slate-900">
                  {data.shipping.shipping_information.service.toUpperCase()}
                  <div className="uppercase">
                    {data.shipping.shipping_information.method}
                  </div>
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Tracking Number
                </div>
                <div className="font-medium max-w-[200px] text-slate-900">
                  <CommandBlock
                    command={
                      data.shipping.tracking_number ?? generateRandomSlug()
                    }
                  />
                </div>

                {data.shipping.shipping_information.accountNumber && (
                  <div className="text-slate-600">
                    Account: ****
                    {data.shipping.shipping_information.accountNumber.slice(-4)}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* PART CARDS */}
          <section className="space-y-4">
            <SectionTitle title="Line Items" />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.parts.map((part) => (
                <button
                  key={part.order_part_id}
                  onClick={() => setSelectedPart(part)}
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

                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Unit
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                          {formatCurrencyGeneric(part.unit_price)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          Total
                        </div>
                        <div className="text-sm font-bold text-indigo-600">
                          {formatCurrencyGeneric(part.total_price)}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* SUMMARY TABLE */}
          <section className="space-y-4">
            <SectionTitle title="Summary" />

            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                {/* Header */}
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-slate-600">
                      Line Item
                    </th>
                    <th className="px-5 py-3 text-right font-medium text-slate-600">
                      Qty
                    </th>
                    <th className="px-5 py-3 text-right font-medium text-slate-600">
                      Unit Price
                    </th>
                    <th className="px-5 py-3 text-right font-medium text-slate-600">
                      Total
                    </th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="divide-y">
                  {data.parts.map((part) => (
                    <tr key={part.order_part_id}>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {part.rfq_part.file_name}
                      </td>
                      <td className="px-5 py-4 text-right">{part.quantity}</td>
                      <td className="px-5 py-4 text-right">
                        {formatCurrencyGeneric(part.unit_price)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium">
                        {formatCurrencyGeneric(part.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer */}
                <tfoot className="bg-slate-50 border-t">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-3 text-right text-slate-500"
                    >
                      Subtotal
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatCurrencyGeneric(data.order.subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-3 text-right font-semibold"
                    >
                      Total
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-indigo-600">
                      {formatCurrencyGeneric(data.order.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </section>
      )}
      {/* WORKFLOW */}
      {activeTab === "workflow" && (
        <RFQKanban
          parts={data.parts}
          onRefresh={() => fetchData(true)}
          onItemClick={(part) => setSelectedPart(part)}
        />
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

/* =======================
   UI HELPERS (UNCHANGED)
======================= */

export const StatusPill = ({ status }: { status: string }) => (
  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700">
    {status.toUpperCase()}
  </span>
);

export const SectionTitle = ({ title }: { title: string }) => (
  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
    {title}
  </h2>
);

export const Meta = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-slate-400">
      {label}
    </div>
    <div
      className={`${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}
    >
      {value}
    </div>
  </div>
);

export const Value = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) => (
  <div>
    <div className="text-xs text-slate-400">{label}</div>
    <div
      className={`${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}
    >
      {value}
    </div>
  </div>
);

export const AddressCard = ({
  title,
  name,
  address,
}: {
  title: string;
  name: string;
  address: (string | undefined)[];
}) => (
  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-w-[240px]">
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-2">
      {title}
    </div>
    <div className="space-y-0.5">
      <div className="font-bold text-lg text-slate-900 mb-1.5">{name}</div>
      {address.map(
        (line, i) =>
          line && (
            <div
              key={i}
              className="text-sm text-slate-500 font-medium leading-relaxed"
            >
              {line}
            </div>
          ),
      )}
    </div>
  </div>
);

export const Detail = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-slate-400">
      {label}
    </div>
    <div
      className={`${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}
    >
      {value}
    </div>
  </div>
);

export const Placeholder = ({ title }: { title: string }) => (
  <div className="bg-slate-50 border border-dashed rounded-lg p-10 text-center text-sm text-slate-500">
    {title} content will appear here.
  </div>
);
