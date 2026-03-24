"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import CustomLoader from "@/components/ui/loader/CustomLoader";
import { useMetaStore } from "@/components/store/title-store";
import {
  Meta,
  SectionTitle,
  StatusPill,
} from "@/app/portal/orders/[orderId]/page";
import RfqSideDrawer from "@/app/portal/orders/[orderId]/components/rfq-side-drawer";
import { toast } from "sonner";
import SteppedModal from "@/components/ui/modal/SteppedModal";
import { AlertCircle } from "lucide-react";

/* =======================
   TYPES
======================= */

export type IQuoteRequestFull = {
  id: string;
  order_id: string;
  supplier_id: string;
  status: string;
  notes: string;
  created_at: string;
  reject_reason: string;
  responded_at: string;
  order: {
    id: string;
    order_code: string;
    created_at: string;
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
  shipping: any;
};

/* =======================
   PAGE
======================= */

export default function QuoteRequestPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const [selectedPart, setSelectedPart] = useState<any>(null);
  const [data, setData] = useState<IQuoteRequestFull>();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const { setPageTitle, resetTitle } = useMetaStore();

  const fetchData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const response = await apiClient.get(`/quote-request/${id}`);
        setData(response.data.data);
      } catch (error) {
        console.error(error);
        if (!silent) setLoading(false);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    setPageTitle("Quote Request");
    return () => {
      resetTitle();
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAccept = async () => {
    try {
      setProcessing(true);
      await apiClient.patch(`/quote-request/${id}/accept`, {});
      toast.success("Quote request accepted successfully");
      fetchData(true);
      // Optional: redirect to order page if accepted
      // router.push(`/supplier/orders/${data?.order_id}`);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to accept quote request",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = () => {
    setIsDeclineModalOpen(true);
  };

  const handleDeclineSubmit = async () => {
    if (!declineReason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }

    try {
      setProcessing(true);
      await apiClient.patch(`/quote-request/${id}/decline`, {
        reason: declineReason,
      });
      toast.success("Quote request declined");
      setIsDeclineModalOpen(false);
      setDeclineReason("");
      fetchData(true);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to decline quote request",
      );
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <CustomLoader />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        Quote request not found
      </div>
    );
  }

  return (
    <div className="relative max-w-7xl h-full mx-auto px-2 py-3 space-y-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              Quote Request: {data.order.order_code}
            </h1>
            <StatusPill status={data.status} />
          </div>
          <p className="text-sm text-slate-500">
            Please review the details and confirm if you can fulfill this order.
          </p>
        </div>

        {data.status === "requested" && (
          <div className="flex items-center gap-3">
            <button
              disabled={processing}
              onClick={handleDecline}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Decline
            </button>
            <button
              disabled={processing}
              onClick={handleAccept}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              Accept Order
            </button>
          </div>
        )}
      </div>

      <section className="space-y-6">
        {/* Meta Data */}
        <section className="space-y-2">
          <SectionTitle title="General Information" />
          <div className="grid grid-cols-2 lg:grid-cols-4 items-center gap-6 bg-white border rounded-lg p-4 text-sm space-y-2">
            <Meta label="Order Code" value={data.order.order_code} />
            <Meta
              label="Requested On"
              value={new Date(data.created_at).toLocaleDateString()}
            />
            <Meta label="Total Items" value={data.parts.length.toString()} />
            <Meta label="Status" value={data.status.toUpperCase()} strong />
          </div>
        </section>

        {/* NOTES */}
        {data.notes && (
          <section className="space-y-2">
            <SectionTitle title="Notes from Admin" />
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-900 italic">
              "{data.notes}"
            </div>
          </section>
        )}

        {/* PART CARDS */}
        {data.status !== "declined" ? (
          <>
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

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-auto">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            Quantity
                          </div>
                          <div className="text-sm font-medium text-slate-700">
                            {part.quantity}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            Status
                          </div>
                          <div className="text-sm font-medium text-slate-700">
                            {part.status}
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
              <SectionTitle title="Parts List Summary" />
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium text-slate-600">
                        Part Name
                      </th>
                      <th className="px-5 py-3 text-left font-medium text-slate-600">
                        Material
                      </th>
                      <th className="px-5 py-3 text-left font-medium text-slate-600">
                        Finish
                      </th>
                      <th className="px-5 py-3 text-right font-medium text-slate-600">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.parts.map((part) => (
                      <tr key={part.order_part_id}>
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {part.rfq_part.file_name}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {part.rfq_part.material}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {part.rfq_part.finish}
                        </td>
                        <td className="px-5 py-4 text-right font-medium">
                          {part.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="space-y-4">
            <SectionTitle title="Decline Details" />
            <div className="bg-red-50 border border-red-100 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-red-500 font-bold">
                    Reason for Declining
                  </div>
                  <div className="text-red-900 font-medium">
                    {data.reject_reason || "No reason provided"}
                  </div>
                </div>
                {data.responded_at && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-red-500 font-bold">
                      Responded At
                    </div>
                    <div className="text-red-900 font-medium">
                      {new Date(data.responded_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </section>

      {/* SIDE DRAWER FOR PART DETAILS */}
      {selectedPart && (
        <RfqSideDrawer
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
        />
      )}

      {/* DECLINE MODAL */}
      <SteppedModal
        isOpen={isDeclineModalOpen}
        onClose={() => setIsDeclineModalOpen(false)}
        title="Decline Quote Request"
        subtitle="Please let us know why you are declining this request"
        icon={<AlertCircle className="text-white" size={20} />}
        steps={[{ id: 1, title: "Decline Reason" }]}
        onSubmit={handleDeclineSubmit}
        submitLabel="Decline Request"
        isLoading={processing}
      >
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Reason for declining
          </label>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="w-full min-h-[120px] p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all resize-none text-slate-800"
            placeholder="E.g. Capacity full, Material not available, etc."
            required
            disabled={processing}
          />
        </div>
      </SteppedModal>
    </div>
  );
}
