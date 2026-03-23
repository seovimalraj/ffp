"use client";

import { useState, useEffect } from "react";
import { X, UserPlus, CheckCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";

interface Supplier {
  id: string;
  name: string;
  users: Array<{ email: string; name: string; id: string }>;
}

interface AssignSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onAssigned: () => void;
}

export function AssignSupplierModal({
  isOpen,
  onClose,
  orderId,
  onAssigned,
}: AssignSupplierModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [selectedUser, setSelectedUser] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    } else {
      // Reset state when closed
      setSelectedSupplierId(null);
      setSelectedUser("");
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/suppliers");
      setSuppliers(res.data.suppliers);
    } catch (error) {
      console.error(error);
      notify.error("Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedSupplierId || !selectedUser) {
      notify.error("Please select a supplier and a contact email");
      return;
    }

    try {
      setAssigning(true);
      await apiClient.post(`/quote-request`, {
        supplier_id: selectedSupplierId,
        order_id: orderId,
        contact_user: selectedUser,
      });
      notify.success("Supplier assigned successfully");
      await onAssigned();
      onClose();
    } catch (error) {
      console.error(error);
      notify.error("Failed to assign supplier");
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Container */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Assign Supplier
              </h2>
              <p className="text-sm text-slate-500">
                Choose a supplier for this order
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <span className="text-sm text-slate-500 font-medium">
                Loading suppliers...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {suppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  onClick={() => {
                    setSelectedSupplierId(supplier.id);
                    // Default to first email if available
                    if (supplier.users?.[0]?.email) {
                      setSelectedUser(supplier.users[0].email);
                    } else {
                      setSelectedUser("");
                    }
                  }}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                    selectedSupplierId === supplier.id
                      ? "border-indigo-500 bg-indigo-50/30 ring-4 ring-indigo-50"
                      : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {supplier.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {supplier.users?.length || 0} contact(s) available
                      </div>
                    </div>
                    {selectedSupplierId === supplier.id && (
                      <div className="text-indigo-600 flex-shrink-0">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Contact Selection */}
          {selectedSupplier && (
            <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Select Notification Email
              </label>
              <div className="space-y-2">
                {selectedSupplier.users && selectedSupplier.users.length > 0 ? (
                  selectedSupplier.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user.id)}
                      className={`w-full p-3 rounded-lg border flex items-center justify-between text-sm transition-all ${
                        selectedUser === user.id
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700 font-medium"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {user.name || "Default user"}
                        </span>
                        <span className="text-xs opacity-70">{user.email}</span>
                      </div>
                      {selectedUser === user.id && (
                        <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-red-500 py-2">
                    No users found for this supplier. A notification email is
                    required.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-white hover:shadow-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning || !selectedSupplierId || !selectedUser}
            className="flex-[2] px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Confirm Assignment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
