"use client";

import { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  CheckCircle,
  Search,
  Mail,
  MessageSquare,
  Building2,
  User,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import SteppedModal from "@/components/ui/modal/SteppedModal";

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

const STEPS = [
  { id: 1, title: "Supplier", description: "Select a partner" },
  { id: 2, title: "Contact", description: "Choose recipient" },
  { id: 3, title: "Notes", description: "Add instructions" },
];

export function AssignSupplierModal({
  isOpen,
  onClose,
  orderId,
  onAssigned,
}: AssignSupplierModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null,
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    } else {
      // Reset state when closed
      setSelectedSupplierId(null);
      setSelectedUserId("");
      setSearchTerm("");
      setNotes("");
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

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [suppliers, searchTerm]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId],
  );

  const handleValidateStep = (step: number) => {
    if (step === 1 && !selectedSupplierId) {
      notify.error("Please select a supplier");
      return false;
    }
    if (step === 2 && !selectedUserId) {
      notify.error("Please select a contact email");
      return false;
    }
    return true;
  };

  const handleAssign = async () => {
    try {
      await apiClient.post(`/quote-request`, {
        supplier_id: selectedSupplierId,
        order_id: orderId,
        contact_user: selectedUserId,
        notes: notes,
      });
      notify.success("Supplier assigned successfully");
      await onAssigned();
      onClose();
    } catch (error) {
      console.error(error);
      notify.error("Failed to assign supplier");
      throw error; // Rethrow so SteppedModal knows there was an error
    }
  };

  return (
    <SteppedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Supplier"
      subtitle={`Set up fulfillment for order #${orderId.slice(0, 8)}`}
      icon={<UserPlus className="text-white w-5 h-5" />}
      steps={STEPS}
      onSubmit={handleAssign}
      onValidateStep={handleValidateStep}
      submitLabel="Confirm Assignment"
      isLoading={loading}
    >
      {({ currentStep }) => (
        <div className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-violet-600 outline-none transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredSuppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => {
                      setSelectedSupplierId(supplier.id);
                      if (supplier.users?.[0]?.id)
                        setSelectedUserId(supplier.users[0].id);
                    }}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      selectedSupplierId === supplier.id
                        ? "border-violet-600 bg-violet-50"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedSupplierId === supplier.id
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Building2 size={18} />
                      </div>
                      <div className="text-left font-semibold text-slate-900">
                        {supplier.name}
                      </div>
                    </div>
                    {selectedSupplierId === supplier.id && (
                      <CheckCircle className="text-violet-600 w-5 h-5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && selectedSupplier && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <Building2 className="text-slate-400" size={20} />
                <div className="font-bold text-slate-900">
                  {selectedSupplier.name}
                </div>
              </div>

              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Select Recipient
              </label>

              <div className="space-y-2">
                {selectedSupplier.users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      selectedUserId === user.id
                        ? "border-violet-600 bg-violet-50"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-bold text-slate-900 text-sm">
                        {user.name}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Mail size={12} /> {user.email}
                      </span>
                    </div>
                    {selectedUserId === user.id && (
                      <div className="w-2.5 h-2.5 rounded-full bg-violet-600 shadow-sm shadow-violet-200" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-violet-50 text-violet-700 rounded-xl border border-violet-100">
                <MessageSquare size={20} />
                <div className="text-sm font-medium">
                  Add internal context or external instructions for the
                  supplier.
                </div>
              </div>

              <textarea
                autoFocus
                rows={6}
                placeholder="Include quality specs, urgency notes, or specific contact instructions..."
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-violet-600 outline-none transition-all text-sm resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </SteppedModal>
  );
}
