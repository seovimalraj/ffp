"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  Shield,
  X,
  Download,
  Upload,
  Info,
  Plus,
  Minus,
  FileText,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";
import { motion, AnimatePresence } from "framer-motion";
import { Member, Service, Permission, AuditLogEntry } from "../types";
import { PERMISSION_TEMPLATES, PERMISSION_TYPE_COLORS } from "../data";
import { getAllPermissionCodes } from "../utils";
import { ServiceNode } from "./service-node";

interface PermissionsModalProps {
  member: Member;
  services: Service[];
  onClose: () => void;
  onSave: (member: Member) => void;
}

export function PermissionsModal({
  member,
  services,
  onClose,
  onSave,
}: PermissionsModalProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(member.permissions),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedServices, setExpandedServices] = useState<Set<string>>(
    new Set(),
  );
  const [expandedResources, setExpandedResources] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPermissionDetail, setSelectedPermissionDetail] =
    useState<Permission | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "permissions" | "templates" | "audit"
  >("permissions");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const originalPermissions = useMemo(
    () => new Set(member.permissions),
    [member.permissions],
  );

  const permissionsDiff = useMemo(() => {
    const added: string[] = [];
    const removed: string[] = [];
    selectedPermissions.forEach((p) => {
      if (!originalPermissions.has(p)) added.push(p);
    });
    originalPermissions.forEach((p) => {
      if (!selectedPermissions.has(p)) removed.push(p);
    });
    return {
      added,
      removed,
      hasChanges: added.length > 0 || removed.length > 0,
    };
  }, [selectedPermissions, originalPermissions]);

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const query = searchQuery.toLowerCase();
    return services
      .map((service) => {
        const filteredResources = service.resources
          .map((resource) => {
            const filteredPermissions = resource.permissions.filter(
              (p) =>
                p.code.toLowerCase().includes(query) ||
                p.name.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query),
            );
            return { ...resource, permissions: filteredPermissions };
          })
          .filter((r) => r.permissions.length > 0);
        return { ...service, resources: filteredResources };
      })
      .filter((s) => s.resources.length > 0);
  }, [services, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const serviceIds = new Set(filteredServices.map((s) => s.id));
      const resourceIds = new Set(
        filteredServices.flatMap((s) =>
          s.resources.map((r) => `${s.id}-${r.id}`),
        ),
      );
      setExpandedServices(serviceIds);
      setExpandedResources(resourceIds);
    }
  }, [searchQuery, filteredServices]);

  const toggleService = (serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const toggleResource = (serviceId: string, resourceId: string) => {
    const key = `${serviceId}-${resourceId}`;
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getSelectionState = (codes: string[]): "none" | "partial" | "all" => {
    const selected = codes.filter((c) => selectedPermissions.has(c)).length;
    if (selected === 0) return "none";
    if (selected === codes.length) return "all";
    return "partial";
  };

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleGroup = (codes: string[]) => {
    const state = getSelectionState(codes);
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (state === "all") codes.forEach((c) => next.delete(c));
      else codes.forEach((c) => next.add(c));
      return next;
    });
  };

  const applyTemplate = (templateKey: keyof typeof PERMISSION_TEMPLATES) => {
    const template = PERMISSION_TEMPLATES[templateKey];
    setSelectedPermissions(new Set(template.permissions));
    notify.info(
      "Template applied",
      `${template.name} permissions have been applied.`,
    );
  };

  const exportPermissions = () => {
    const data = {
      memberId: member.id,
      memberName: member.full_name,
      permissions: Array.from(selectedPermissions),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permissions-${member.full_name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success("Exported", "Permissions exported successfully.");
  };

  const importPermissions = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (Array.isArray(data.permissions)) {
            const validPermissions = data.permissions.filter((p: string) =>
              getAllPermissionCodes(services).includes(p),
            );
            setSelectedPermissions(new Set(validPermissions));
            notify.success(
              "Imported",
              `${validPermissions.length} permissions imported.`,
            );
          }
        } catch {
          notify.error("Import failed", "Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSave = () => {
    onSave({ ...member, permissions: Array.from(selectedPermissions) });
  };

  const auditLog: AuditLogEntry[] = [
    {
      id: "1",
      action: "added",
      permission: "inventory.materials.write",
      timestamp: new Date(Date.now() - 86400000),
      performedBy: "Admin User",
    },
    {
      id: "2",
      action: "removed",
      permission: "billing.payments.manage",
      timestamp: new Date(Date.now() - 172800000),
      performedBy: "Admin User",
    },
    {
      id: "3",
      action: "added",
      permission: "orders.quotes.read",
      timestamp: new Date(Date.now() - 259200000),
      performedBy: "System",
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-5xl mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-lg">
                {member.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                  {member.full_name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {member.email} • {member.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportPermissions}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Export permissions"
              >
                <Download size={18} />
              </button>
              <button
                onClick={importPermissions}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Import permissions"
              >
                <Upload size={18} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
            <button
              onClick={() => setActiveTab("permissions")}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "permissions"
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400",
              )}
            >
              <Shield size={16} className="inline mr-2" />
              Permissions
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "templates"
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400",
              )}
            >
              <FileText size={16} className="inline mr-2" />
              Templates
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "audit"
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400",
              )}
            >
              <Clock size={16} className="inline mr-2" />
              Audit Log
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {activeTab === "permissions" && (
              <>
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search permissions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {selectedPermissions.size} of{" "}
                        {getAllPermissionCodes(services).length} permissions
                        selected
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setSelectedPermissions(
                              new Set(getAllPermissionCodes(services)),
                            )
                          }
                          className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedPermissions(new Set())}
                          className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                  </div>
                  <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4"
                  >
                    <div className="space-y-2">
                      {filteredServices.map((service) => (
                        <ServiceNode
                          key={service.id}
                          service={service}
                          isExpanded={expandedServices.has(service.id)}
                          expandedResources={expandedResources}
                          selectedPermissions={selectedPermissions}
                          onToggleService={() => toggleService(service.id)}
                          onToggleResource={(resourceId) =>
                            toggleResource(service.id, resourceId)
                          }
                          onTogglePermission={togglePermission}
                          onToggleGroup={toggleGroup}
                          getSelectionState={getSelectionState}
                          onSelectPermissionDetail={setSelectedPermissionDetail}
                        />
                      ))}
                      {filteredServices.length === 0 && (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          No permissions match your search.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Details panel */}
                <div className="w-80 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex flex-col">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-medium text-slate-800 dark:text-white">
                      Permission Details
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {selectedPermissionDetail ? (
                      <div className="space-y-4">
                        <div>
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                              PERMISSION_TYPE_COLORS[
                                selectedPermissionDetail.type
                              ],
                            )}
                          >
                            {selectedPermissionDetail.type}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-800 dark:text-white">
                            {selectedPermissionDetail.name}
                          </h4>
                          <code className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                            {selectedPermissionDetail.code}
                          </code>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {selectedPermissionDetail.description}
                        </p>
                        {selectedPermissionDetail.impact && (
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-start gap-2">
                              <Info
                                size={16}
                                className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
                              />
                              <div>
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                  Impact Level
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                  {selectedPermissionDetail.impact}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() =>
                            togglePermission(selectedPermissionDetail.code)
                          }
                          className={cn(
                            "w-full py-2 rounded-lg text-sm font-medium transition-colors",
                            selectedPermissions.has(
                              selectedPermissionDetail.code,
                            )
                              ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400",
                          )}
                        >
                          {selectedPermissions.has(
                            selectedPermissionDetail.code,
                          )
                            ? "Remove Permission"
                            : "Add Permission"}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 dark:text-slate-500 py-8">
                        <Info size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          Select a permission to view details
                        </p>
                      </div>
                    )}
                  </div>
                  {permissionsDiff.hasChanges && (
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <button
                        onClick={() => setShowDiff(!showDiff)}
                        className="flex items-center justify-between w-full text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        <span>Pending Changes</span>
                        <ChevronDown
                          size={16}
                          className={cn(
                            "transition-transform",
                            showDiff && "rotate-180",
                          )}
                        />
                      </button>
                      {showDiff && (
                        <div className="mt-3 space-y-2 text-xs">
                          {permissionsDiff.added.length > 0 && (
                            <div>
                              <p className="text-green-600 dark:text-green-400 font-medium">
                                + {permissionsDiff.added.length} added
                              </p>
                              {permissionsDiff.added.slice(0, 3).map((p) => (
                                <p
                                  key={p}
                                  className="text-slate-500 dark:text-slate-400 truncate pl-2"
                                >
                                  {p}
                                </p>
                              ))}
                              {permissionsDiff.added.length > 3 && (
                                <p className="text-slate-400 pl-2">
                                  ...and {permissionsDiff.added.length - 3} more
                                </p>
                              )}
                            </div>
                          )}
                          {permissionsDiff.removed.length > 0 && (
                            <div>
                              <p className="text-red-600 dark:text-red-400 font-medium">
                                - {permissionsDiff.removed.length} removed
                              </p>
                              {permissionsDiff.removed.slice(0, 3).map((p) => (
                                <p
                                  key={p}
                                  className="text-slate-500 dark:text-slate-400 truncate pl-2"
                                >
                                  {p}
                                </p>
                              ))}
                              {permissionsDiff.removed.length > 3 && (
                                <p className="text-slate-400 pl-2">
                                  ...and {permissionsDiff.removed.length - 3}{" "}
                                  more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "templates" && (
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="grid gap-4">
                  {Object.entries(PERMISSION_TEMPLATES).map(
                    ([key, template]) => (
                      <div
                        key={key}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-300 dark:hover:border-teal-600 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-slate-800 dark:text-white">
                              {template.name}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {template.description}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                              {template.permissions.length} permissions
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              applyTemplate(
                                key as keyof typeof PERMISSION_TEMPLATES,
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50 text-sm font-medium transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {activeTab === "audit" && (
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-3">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          entry.action === "added"
                            ? "bg-green-100 dark:bg-green-900/30"
                            : "bg-red-100 dark:bg-red-900/30",
                        )}
                      >
                        {entry.action === "added" ? (
                          <Plus
                            size={14}
                            className="text-green-600 dark:text-green-400"
                          />
                        ) : (
                          <Minus
                            size={14}
                            className="text-red-600 dark:text-red-400"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 dark:text-white">
                          <span className="font-medium">
                            {entry.performedBy}
                          </span>{" "}
                          {entry.action === "added" ? "added" : "removed"}{" "}
                          <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">
                            {entry.permission}
                          </code>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {entry.timestamp.toLocaleDateString()} at{" "}
                          {entry.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {permissionsDiff.hasChanges ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {permissionsDiff.added.length +
                    permissionsDiff.removed.length}{" "}
                  unsaved changes
                </span>
              ) : (
                "No changes"
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!permissionsDiff.hasChanges}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  permissionsDiff.hasChanges
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed",
                )}
              >
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
