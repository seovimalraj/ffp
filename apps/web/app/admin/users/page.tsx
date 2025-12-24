"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Search,
  Edit,
  UserCheck,
  UserX,
  Plus,
  Mail,
  Shield,
  Building2,
  Activity,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Lock,
  Unlock,
} from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member" | "supplier" | "viewer";
  organization: string;
  organizationId: number;
  status: "active" | "pending" | "suspended" | "inactive";
  created: string;
  lastLogin: string;
  permissions: string[];
  twoFactorEnabled: boolean;
}

interface Organization {
  id: number;
  name: string;
  users: number;
  plan: "Starter" | "Professional" | "Enterprise" | "Supplier";
  status: "active" | "trial" | "suspended";
  created: string;
  monthlySpend: number;
  totalOrders: number;
}

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "member" as User["role"],
    organizationId: 0,
  });

  const users: User[] = [];

  const organizations: Organization[] = [];
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.organization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === "active").length,
    pendingUsers: users.filter((u) => u.status === "pending").length,
    suspendedUsers: users.filter((u) => u.status === "suspended").length,
    twoFactorEnabled: users.filter((u) => u.twoFactorEnabled).length,
  };

  const orgStats = {
    totalOrgs: organizations.length,
    activeOrgs: organizations.filter((o) => o.status === "active").length,
    trialOrgs: organizations.filter((o) => o.status === "trial").length,
    totalRevenue: organizations.reduce((sum, o) => sum + o.monthlySpend, 0),
  };

  const handleInviteUser = () => {
    console.log("Inviting user:", newUser);
    setShowInviteDialog(false);
    setNewUser({ name: "", email: "", role: "member", organizationId: 0 });
  };

  const handleEditUser = () => {
    console.log("Editing user:", selectedUser);
    setShowEditDialog(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = () => {
    console.log("Deleting user:", selectedUser);
    setShowDeleteDialog(false);
    setSelectedUser(null);
  };

  const handleApproveUser = (user: User) => {
    console.log("Approving user:", user);
  };

  const handleSuspendUser = (user: User) => {
    console.log("Suspending user:", user);
  };

  const getRoleBadge = (role: User["role"]) => {
    const variants = {
      admin: "bg-red-100 text-red-700 border-red-200",
      member: "bg-blue-100 text-blue-700 border-blue-200",
      supplier: "bg-purple-100 text-purple-700 border-purple-200",
      viewer: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return (
      <Badge className={`${variants[role]} border`}>{role.toUpperCase()}</Badge>
    );
  };

  const getStatusBadge = (status: User["status"]) => {
    const variants = {
      active: {
        icon: CheckCircle,
        class: "bg-green-100 text-green-700 border-green-200",
      },
      pending: {
        icon: Clock,
        class: "bg-yellow-100 text-yellow-700 border-yellow-200",
      },
      suspended: {
        icon: XCircle,
        class: "bg-red-100 text-red-700 border-red-200",
      },
      inactive: {
        icon: AlertTriangle,
        class: "bg-gray-100 text-gray-700 border-gray-200",
      },
    };
    const StatusIcon = variants[status].icon;
    return (
      <Badge
        className={`${variants[status].class} border flex items-center gap-1`}
      >
        <StatusIcon className="w-3 h-3" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Users & Organizations
          </h1>
          <p className="text-gray-600 mt-1">
            Manage users, roles, and organization access
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {}}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setShowInviteDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalUsers}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.activeUsers}
                </p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.pendingUsers}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Suspended</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.suspendedUsers}
                </p>
              </div>
              <UserX className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">2FA Enabled</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.twoFactorEnabled}
                </p>
              </div>
              <Shield className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="organizations">
            Organizations ({organizations.length})
          </TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, email, or organization..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="hover:shadow-md transition-shadow bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      User
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Role
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Organization
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Status
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Last Login
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      2FA
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {user.name}
                          </div>
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {user.organization}
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(user.status)}</td>
                      <td className="p-4">
                        <div className="text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {user.lastLogin}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {user.twoFactorEnabled ? (
                          <Badge className="bg-green-100 text-green-700 border-0 flex items-center gap-1 w-fit">
                            <Lock className="w-3 h-3" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 border-0 flex items-center gap-1 w-fit">
                            <Unlock className="w-3 h-3" />
                            Disabled
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {user.status === "pending" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApproveUser(user)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                          )}
                          {user.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuspendUser(user)}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Suspend
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          {/* Org Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Orgs</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {orgStats.totalOrgs}
                    </p>
                  </div>
                  <Building2 className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active</p>
                    <p className="text-2xl font-bold text-green-600">
                      {orgStats.activeOrgs}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">On Trial</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {orgStats.trialOrgs}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Monthly Revenue
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${(orgStats.totalRevenue / 1000).toFixed(0)}K
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Organizations Table */}
          <Card className="hover:shadow-md transition-shadow bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Organization
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Users
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Plan
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Status
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Monthly Spend
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Total Orders
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Created
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => (
                    <tr
                      key={org.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {org.name}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 w-fit"
                        >
                          <Users className="w-3 h-3" />
                          {org.users}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          className={`
                          ${org.plan === "Enterprise" ? "bg-purple-100 text-purple-700 border-purple-200" : ""}
                          ${org.plan === "Professional" ? "bg-blue-100 text-blue-700 border-blue-200" : ""}
                          ${org.plan === "Starter" ? "bg-gray-100 text-gray-700 border-gray-200" : ""}
                          ${org.plan === "Supplier" ? "bg-green-100 text-green-700 border-green-200" : ""}
                          border
                        `}
                        >
                          {org.plan}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          className={`
                          ${org.status === "active" ? "bg-green-100 text-green-700 border-green-200" : ""}
                          ${org.status === "trial" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : ""}
                          ${org.status === "suspended" ? "bg-red-100 text-red-700 border-red-200" : ""}
                          border capitalize
                        `}
                        >
                          {org.status}
                        </Badge>
                      </td>
                      <td className="p-4 font-semibold text-gray-900">
                        ${org.monthlySpend.toLocaleString()}
                      </td>
                      <td className="p-4 text-gray-700">{org.totalOrders}</td>
                      <td className="p-4 text-gray-600">{org.created}</td>
                      <td className="p-4">
                        <Button size="sm" variant="outline">
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[
                  {
                    user: "John Smith",
                    action: "logged in",
                    time: "2 minutes ago",
                    icon: CheckCircle,
                    color: "text-green-600",
                  },
                  {
                    user: "Admin User",
                    action: "created new user",
                    time: "15 minutes ago",
                    icon: Plus,
                    color: "text-blue-600",
                  },
                  {
                    user: "Sarah Johnson",
                    action: "updated profile",
                    time: "1 hour ago",
                    icon: Edit,
                    color: "text-purple-600",
                  },
                  {
                    user: "Admin User",
                    action: "suspended user account",
                    time: "2 hours ago",
                    icon: XCircle,
                    color: "text-red-600",
                  },
                  {
                    user: "New User",
                    action: "registered",
                    time: "3 hours ago",
                    icon: UserCheck,
                    color: "text-green-600",
                  },
                ].map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
                    >
                      <div
                        className={`p-2 rounded-lg bg-gray-50 ${activity.color}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900">
                          <span className="font-semibold">{activity.user}</span>{" "}
                          {activity.action}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-900">Name</Label>
              <Input
                value={newUser.name}
                onChange={(e) =>
                  setNewUser({ ...newUser, name: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label className="text-gray-900">Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="john@company.com"
              />
            </div>
            <div>
              <Label className="text-gray-900">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: User["role"]) =>
                  setNewUser({ ...newUser, role: value })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-900">Organization</Label>
              <Select
                value={newUser.organizationId.toString()}
                onValueChange={(value) =>
                  setNewUser({ ...newUser, organizationId: parseInt(value) })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations
                    .filter((o) => o.status === "active")
                    .map((org) => (
                      <SelectItem key={org.id} value={org.id.toString()}>
                        {org.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteUser}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-900">Name</Label>
                <Input
                  defaultValue={selectedUser.name}
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-900">Email</Label>
                <Input
                  type="email"
                  defaultValue={selectedUser.email}
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-900">Role</Label>
                <Select defaultValue={selectedUser.role}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-900">Status</Label>
                <Select defaultValue={selectedUser.status}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditUser}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-900">
                  User: {selectedUser.name}
                </p>
                <p className="text-sm text-red-700">
                  Email: {selectedUser.email}
                </p>
                <p className="text-sm text-red-700">
                  Organization: {selectedUser.organization}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
