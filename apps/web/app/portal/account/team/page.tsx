"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UsersIcon,
  ArrowLeftIcon,
  UserPlusIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  UserMinusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import type {
  Member,
  MembersListResponse,
  InviteFormData,
} from "@/types/order";
import { trackEvent } from "@/lib/analytics/posthog";

const ROLE_OPTIONS = [
  { value: "buyer", label: "Buyer" },
  { value: "org_admin", label: "Organization Admin" },
  { value: "reviewer", label: "Reviewer" },
  { value: "operator", label: "Operator" },
  { value: "finance", label: "Finance" },
];

const ITEMS_PER_PAGE = 25;

export default function TeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, _] = useState(1);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: "",
    role: "buyer",
  });
  const [roleForm, setRoleForm] = useState({ role: "buyer" });
  const [inviting, setInviting] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  // Load members
  useEffect(() => {
    loadMembers();
  }, [page]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get<MembersListResponse>(
        `/org/members?page=${page}&limit=${ITEMS_PER_PAGE}`,
      );
      setMembers(response.data.members);
      setTotal(response.data.total);
      trackEvent("team_view");
    } catch (error: any) {
      console.error("Error loading members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    try {
      setInviting(true);
      await api.post("/org/invites", inviteForm);
      toast.success("Invitation sent successfully");
      trackEvent("invite_sent", { role: inviteForm.role });
      setShowInviteDialog(false);
      setInviteForm({ email: "", role: "buyer" });
      await loadMembers(); // Refresh list
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast.error(error.response?.data?.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (member: Member) => {
    try {
      await api.post(`/org/invites/${member.user_id}/resend`);
      toast.success("Invitation resent successfully");
    } catch (error: any) {
      console.error("Error resending invite:", error);
      toast.error("Failed to resend invitation");
    }
  };

  const handleChangeRole = async () => {
    if (!selectedMember) return;

    try {
      setUpdatingRole(true);
      await api.put(`/org/members/${selectedMember.user_id}/role`, {
        role: roleForm.role,
      });
      toast.success("Role updated successfully");
      trackEvent("role_changed", {
        user_id: selectedMember.user_id,
        old_role: selectedMember.role,
        new_role: roleForm.role,
      });
      setShowRoleDialog(false);
      setSelectedMember(null);
      await loadMembers(); // Refresh list
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDisableMember = async (member: Member) => {
    try {
      await api.put(`/org/members/${member.user_id}/disable`);
      toast.success("Member disabled successfully");
      trackEvent("member_disabled", { user_id: member.user_id });
      await loadMembers(); // Refresh list
    } catch (error: any) {
      console.error("Error disabling member:", error);
      toast.error("Failed to disable member");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "org_admin":
        return "destructive";
      case "reviewer":
        return "secondary";
      case "operator":
        return "outline";
      case "finance":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "invited":
        return "secondary";
      case "disabled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatLastActive = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/portal/account")}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Account
            </Button>
          </div>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlusIcon className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    placeholder="colleague@company.com"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value) =>
                      setInviteForm({ ...inviteForm, role: value as any })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowInviteDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting}>
                    {inviting ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-2">
            Invite team members and manage roles and permissions.
          </p>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Members
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{total}</p>
                </div>
                <UsersIcon className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {members.filter((m) => m.status === "active").length}
                  </p>
                </div>
                <ShieldCheckIcon className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {members.filter((m) => m.status === "invited").length}
                  </p>
                </div>
                <EnvelopeIcon className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Admins</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {members.filter((m) => m.role === "org_admin").length}
                  </p>
                </div>
                <UserMinusIcon className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">
                      {member.user?.name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {member.user?.email || member.user_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {ROLE_OPTIONS.find((r) => r.value === member.role)
                          ?.label || member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(member.status)}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatLastActive(member.last_active_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <EllipsisVerticalIcon className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedMember(member);
                              setRoleForm({ role: member.role });
                              setShowRoleDialog(true);
                            }}
                          >
                            Change Role
                          </DropdownMenuItem>
                          {member.status === "invited" && (
                            <DropdownMenuItem
                              onClick={() => handleResendInvite(member)}
                            >
                              Resend Invite
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDisableMember(member)}
                            className="text-red-600"
                          >
                            Disable Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {members.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No team members found. Invite your first team member to get
                started.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Role Dialog */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="change-role">New Role</Label>
                <Select
                  value={roleForm.role}
                  onValueChange={(value) => setRoleForm({ role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRoleDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleChangeRole} disabled={updatingRole}>
                  {updatingRole ? "Updating..." : "Update Role"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
