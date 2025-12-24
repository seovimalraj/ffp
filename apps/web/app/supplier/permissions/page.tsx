"use client";

import { useState, useEffect } from "react";
import { Shield, Trash2, Zap } from "lucide-react";
import { notify } from "@/lib/toast";
import { DataTable, Column, Action } from "@/components/ui/data-table";
import { Member } from "./types";
import { SAMPLE_SERVICES } from "./data";
import { QuickPermissionsModal } from "./components/quick-permissions-modal";
import { apiClient } from "@/lib/api";
import { PermissionsModal } from "./components";

export default function PermissionsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);

  useEffect(() => {
    async function fetchMembers() {
      try {
        setIsPermissionLoading(true);
        const response = await apiClient.get("/supplier/members");
        console.log(response.data);
        setMembers(response.data.members);
      } catch (error) {
        console.error(error);
      } finally {
        setIsPermissionLoading(false);
      }
    }
    fetchMembers();
  }, [refresh]);

  const handleQuickPermissions = (member: Member) => {
    setSelectedMember({ ...member });
    setIsQuickModalOpen(true);
  };

  const handleRemoveMember = (member: Member) => {
    if (confirm(`Are you sure you want to remove ${member.full_name}?`)) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      notify.success(
        "Member removed",
        `${member.full_name} has been removed from the organization.`,
      );
    }
  };

  const handleSavePermissions = () => {
    setIsQuickModalOpen(false);
    setSelectedMember(null);
    setRefresh((o) => !o);
  };

  const columns: Column<Member>[] = [
    {
      key: "name",
      header: "Member",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-medium text-sm">
            {row.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <p className="font-medium text-foreground">{row.full_name}</p>
            <p className="text-sm text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          {row.role}
        </span>
      ),
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.permissions.length} assigned
        </span>
      ),
    },
  ];

  const actions: Action<Member>[] = [
    {
      label: "Quick Permissions",
      onClick: handleQuickPermissions,
      icon: <Zap size={14} />,
      className: "text-yellow-600 dark:text-yellow-400",
    },
    {
      label: "Mange Permissions",
      onClick: (member) => {
        setSelectedMember(member);
        setIsPermissionModalOpen(true);
      },
      icon: <Shield size={14} />,
      className: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Remove Member",
      onClick: handleRemoveMember,
      icon: <Trash2 size={14} />,
      className: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Organization Members
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage team members and their permissions with granular access
          control.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={members}
        actions={actions}
        keyExtractor={(row) => row.id}
        emptyMessage="No members found."
        searchableColumns={["name", "email"]}
        isLoading={isPermissionLoading}
      />

      {isQuickModalOpen && selectedMember && (
        <QuickPermissionsModal
          member={selectedMember}
          onClose={() => {
            setIsQuickModalOpen(false);
            setSelectedMember(null);
          }}
          onSave={handleSavePermissions}
        />
      )}

      {isPermissionModalOpen && selectedMember && (
        <PermissionsModal
          member={selectedMember}
          onClose={() => {
            setIsPermissionModalOpen(false);
            setSelectedMember(null);
          }}
          services={SAMPLE_SERVICES}
          onSave={() => {}}
        />
      )}
    </div>
  );
}
