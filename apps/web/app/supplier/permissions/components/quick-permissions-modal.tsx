"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Shield, Plus, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";
import { motion, AnimatePresence } from "framer-motion";
import { Member, DbPermission } from "../types";
import { apiClient } from "@/lib/api";

interface QuickPermissionsModalProps {
  member: Member;
  onClose: () => void;
  onSave: (member: Member) => void;
  onAfterClose?: () => void; // Optional callback after modal closes
}

export function QuickPermissionsModal({
  member,
  onClose,
  onSave,
  onAfterClose,
}: QuickPermissionsModalProps) {
  const [allPermissions, setAllPermissions] = useState<DbPermission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(member.permissions),
  );
  const [selectedToAdd, setSelectedToAdd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPermissions, setDeletingPermissions] = useState<Set<string>>(
    new Set(),
  );
  useEffect(() => {
    async function fetchPermissions() {
      try {
        const response = await apiClient.get("/permissions/all");
        setAllPermissions(response.data.permissions || []);
      } catch (error) {
        console.error(error);
        notify.error("Error", "Failed to load permissions");
      } finally {
        setLoading(false);
      }
    }
    fetchPermissions();
  }, []);

  console.log(member);

  const codeToPermissionIdMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const permission of allPermissions) {
      map.set(permission.code, permission.id);
    }

    return map;
  }, [allPermissions]);

  const currentPermissions = useMemo(() => {
    return allPermissions.filter((p) => selectedPermissions.has(p.code));
  }, [allPermissions, selectedPermissions]);

  const availablePermissions = useMemo(() => {
    return allPermissions.filter((p) => !selectedPermissions.has(p.code));
  }, [allPermissions, selectedPermissions]);

  const groupedAvailable = useMemo(() => {
    const groups: Record<string, DbPermission[]> = {};
    availablePermissions.forEach((p) => {
      const category = p.category || p.meta || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    return groups;
  }, [availablePermissions]);

  const handleAddPermission = () => {
    if (!selectedToAdd) return;
    setSelectedPermissions(
      (prev) => new Set([...Array.from(prev), selectedToAdd]),
    );
    setSelectedToAdd("");
  };

  const handleRemovePermission = async (code: string) => {
    const permissionId = codeToPermissionIdMap.get(code);

    if (!permissionId) {
      notify.error("Error", "Permission not found");
      return;
    }

    // Add to deleting state
    setDeletingPermissions((prev) => new Set([...Array.from(prev), code]));

    try {
      // Call delete API
      await apiClient.delete(`/supplier/permission`, {
        data: {
          permissionId,
          userId: member.id,
        },
      });

      // Remove from selected permissions on success
      setSelectedPermissions((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });

      notify.success("Success", "Permission removed successfully");
    } catch (error) {
      console.error(error);
      notify.error("Error", "Failed to remove permission");
    } finally {
      // Remove from deleting state
      setDeletingPermissions((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }
  };

  console.log(codeToPermissionIdMap);

  const handleSave = async () => {
    setSaving(true);

    try {
      const original = new Set(member.permissions);
      const updated = selectedPermissions;

      // 1. Compute new permissions (added)
      const addedCodes = Array.from(updated).filter(
        (code) => !original.has(code),
      );

      const addedPermissionIds = addedCodes
        .map((code) => codeToPermissionIdMap.get(code))
        .filter((id): id is string => Boolean(id));

      // Example POST call
      await apiClient.post(`/supplier/permission`, {
        permissions: addedPermissionIds,
        roleId: member.role_id,
        reason: "",
        expiredAt: null,
        targetUserId: member.id,
      });

      notify.success("Success", "Permissions updated successfully");
      onSave({ ...member, permissions: Array.from(selectedPermissions) });

      // Close modal after save
      handleClose();
    } catch (error) {
      console.error(error);
      notify.error("Error", "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = useMemo(() => {
    const original = new Set(member.permissions);
    if (original.size !== selectedPermissions.size) return true;
    const selectedArray = Array.from(selectedPermissions);
    for (let i = 0; i < selectedArray.length; i++) {
      if (!original.has(selectedArray[i])) return true;
    }
    return false;
  }, [member.permissions, selectedPermissions]);

  // Handle close with optional confirmation
  const handleClose = () => {
    // Check for unsaved changes (only for added permissions, not deleted ones)
    // if (hasUnsavedChanges && hasChanges) {
    //   const confirmClose = window.confirm(
    //     "You have unsaved changes. Are you sure you want to close?"
    //   );
    //   if (!confirmClose) return;
    // }

    onClose();

    // Execute any cleanup or post-close actions
    if (onAfterClose) {
      // Small delay to ensure modal animation completes
      setTimeout(() => {
        onAfterClose();
      }, 300);
    }
  };

  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not its children
    if (e.target === e.currentTarget) {
      console.log("Clicked outside modal");
      handleClose();
    }
  };

  return (
    <AnimatePresence
      onExitComplete={() => {
        // This runs after the exit animation completes
        console.log("Modal animation finished");
        if (onAfterClose) {
          onAfterClose();
        }
      }}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={handleBackdropClick}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-lg mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold">
                {member.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {member.full_name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {member.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
            ) : (
              <>
                {/* Current Permissions */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Shield size={16} />
                    Current Permissions ({currentPermissions.length})
                  </h3>
                  {currentPermissions.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      No permissions assigned
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {currentPermissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                              {permission.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {permission.code}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              handleRemovePermission(permission.code)
                            }
                            disabled={deletingPermissions.has(permission.code)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              deletingPermissions.has(permission.code)
                                ? "text-slate-400 cursor-not-allowed"
                                : "text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30",
                            )}
                            title="Remove permission"
                          >
                            {deletingPermissions.has(permission.code) ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Permission */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Plus size={16} />
                    Add Permission
                  </h3>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={selectedToAdd}
                        onChange={(e) => setSelectedToAdd(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      >
                        <option value="">Select a permission...</option>
                        {Object.entries(groupedAvailable).map(
                          ([category, permissions]) => (
                            <optgroup
                              key={category}
                              label={
                                category.charAt(0).toUpperCase() +
                                category.slice(1)
                              }
                            >
                              {permissions.map((p) => (
                                <option key={p.id} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </optgroup>
                          ),
                        )}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <button
                      onClick={handleAddPermission}
                      disabled={!selectedToAdd}
                      className={cn(
                        "px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2",
                        selectedToAdd
                          ? "bg-teal-600 text-white hover:bg-teal-700"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed",
                      )}
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {hasChanges ? (
                <span className="text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              ) : (
                "No changes"
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2",
                  hasChanges && !saving
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed",
                )}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
