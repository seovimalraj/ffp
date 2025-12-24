"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Search,
  Mail,
  Phone,
  Building2,
  DollarSign,
  Eye,
  Plus,
  Edit,
  MapPin,
  Package,
  TrendingUp,
  Star,
  MessageSquare,
  Download,
  BarChart3,
  Activity,
  Clock,
} from "lucide-react";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  joined: string;
  lastOrder: string;
  orders: number;
  totalSpent: number;
  avgOrderValue: number;
  status: "active" | "inactive" | "vip" | "at-risk";
  paymentTerms: string;
  creditLimit: number;
  rating: number;
}

export default function AdminCustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    industry: "Manufacturing",
    address: "",
    city: "",
    state: "",
    zipcode: "",
  });

  const customers: Customer[] = [
    {
      id: 1,
      name: "John Smith",
      email: "john@acme.com",
      phone: "+1 (555) 123-4567",
      company: "Acme Manufacturing",
      industry: "Aerospace",
      address: "123 Industry Blvd",
      city: "Los Angeles",
      state: "CA",
      zipcode: "90001",
      joined: "2024-01-15",
      lastOrder: "2024-11-03",
      orders: 45,
      totalSpent: 425000,
      avgOrderValue: 9444,
      status: "vip",
      paymentTerms: "Net 30",
      creditLimit: 100000,
      rating: 4.9,
    },
    {
      id: 2,
      name: "Sarah Johnson",
      email: "sarah@techcorp.com",
      phone: "+1 (555) 234-5678",
      company: "TechCorp Industries",
      industry: "Electronics",
      address: "456 Tech Park",
      city: "San Francisco",
      state: "CA",
      zipcode: "94102",
      joined: "2024-02-20",
      lastOrder: "2024-11-04",
      orders: 38,
      totalSpent: 380000,
      avgOrderValue: 10000,
      status: "active",
      paymentTerms: "Net 45",
      creditLimit: 75000,
      rating: 4.7,
    },
    {
      id: 3,
      name: "Michael Brown",
      email: "mike@globalrobotics.com",
      phone: "+1 (555) 345-6789",
      company: "Global Robotics Ltd",
      industry: "Robotics",
      address: "789 Automation Way",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
      joined: "2024-03-10",
      lastOrder: "2024-11-01",
      orders: 32,
      totalSpent: 298000,
      avgOrderValue: 9312,
      status: "active",
      paymentTerms: "Net 30",
      creditLimit: 50000,
      rating: 4.8,
    },
    {
      id: 4,
      name: "Robert Davis",
      email: "robert@aerospace.com",
      phone: "+1 (555) 456-7890",
      company: "AeroSpace Dynamics",
      industry: "Aerospace",
      address: "321 Flight Road",
      city: "Seattle",
      state: "WA",
      zipcode: "98101",
      joined: "2023-11-05",
      lastOrder: "2024-11-05",
      orders: 52,
      totalSpent: 625000,
      avgOrderValue: 12019,
      status: "vip",
      paymentTerms: "Net 60",
      creditLimit: 150000,
      rating: 4.9,
    },
    {
      id: 5,
      name: "Lisa Anderson",
      email: "lisa@meddevice.com",
      phone: "+1 (555) 567-8901",
      company: "MedDevice Inc",
      industry: "Medical",
      address: "555 Healthcare Plaza",
      city: "Chicago",
      state: "IL",
      zipcode: "60601",
      joined: "2024-04-12",
      lastOrder: "2024-10-15",
      orders: 25,
      totalSpent: 312000,
      avgOrderValue: 12480,
      status: "at-risk",
      paymentTerms: "Net 30",
      creditLimit: 60000,
      rating: 4.6,
    },
    {
      id: 6,
      name: "David Wilson",
      email: "david@automotive.com",
      phone: "+1 (555) 678-9012",
      company: "Automotive Parts Co",
      industry: "Automotive",
      address: "777 Motor Drive",
      city: "Detroit",
      state: "MI",
      zipcode: "48201",
      joined: "2024-05-20",
      lastOrder: "2024-11-02",
      orders: 29,
      totalSpent: 245000,
      avgOrderValue: 8448,
      status: "active",
      paymentTerms: "Net 30",
      creditLimit: 40000,
      rating: 4.5,
    },
    {
      id: 7,
      name: "Jennifer Martinez",
      email: "jennifer@defense.com",
      phone: "+1 (555) 789-0123",
      company: "Defense Systems",
      industry: "Defense",
      address: "999 Security Blvd",
      city: "Washington",
      state: "DC",
      zipcode: "20001",
      joined: "2024-06-10",
      lastOrder: "2024-11-04",
      orders: 18,
      totalSpent: 425000,
      avgOrderValue: 23611,
      status: "vip",
      paymentTerms: "Net 90",
      creditLimit: 200000,
      rating: 5.0,
    },
    {
      id: 8,
      name: "James Taylor",
      email: "james@energy.com",
      phone: "+1 (555) 890-1234",
      company: "Energy Solutions",
      industry: "Energy",
      address: "111 Power Street",
      city: "Houston",
      state: "TX",
      zipcode: "77001",
      joined: "2024-07-15",
      lastOrder: "2024-09-20",
      orders: 12,
      totalSpent: 180000,
      avgOrderValue: 15000,
      status: "inactive",
      paymentTerms: "Net 45",
      creditLimit: 35000,
      rating: 4.3,
    },
  ];

  const industries = Array.from(new Set(customers.map((c) => c.industry)));

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesIndustry =
      industryFilter === "all" || c.industry === industryFilter;
    return matchesSearch && matchesStatus && matchesIndustry;
  });

  const stats = {
    totalCustomers: customers.length,
    activeCustomers: customers.filter(
      (c) => c.status === "active" || c.status === "vip",
    ).length,
    vipCustomers: customers.filter((c) => c.status === "vip").length,
    atRiskCustomers: customers.filter((c) => c.status === "at-risk").length,
    totalOrders: customers.reduce((sum, c) => sum + c.orders, 0),
    totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
    avgOrderValue:
      customers.reduce((sum, c) => sum + c.avgOrderValue, 0) / customers.length,
    avgRating:
      customers.reduce((sum, c) => sum + c.rating, 0) / customers.length,
  };

  const topCustomers = [...customers]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);
  const recentOrders = [...customers]
    .sort(
      (a, b) =>
        new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime(),
    )
    .slice(0, 5);

  const handleAddCustomer = () => {
    console.log("Adding customer:", newCustomer);
    setShowAddDialog(false);
    setNewCustomer({
      name: "",
      email: "",
      phone: "",
      company: "",
      industry: "Manufacturing",
      address: "",
      city: "",
      state: "",
      zipcode: "",
    });
  };

  const getStatusBadge = (status: Customer["status"]) => {
    const variants = {
      active: "bg-green-100 text-green-700 border-green-200",
      inactive: "bg-gray-100 text-gray-700 border-gray-200",
      vip: "bg-purple-100 text-purple-700 border-purple-200",
      "at-risk": "bg-red-100 text-red-700 border-red-200",
    };
    const icons = {
      active: Activity,
      inactive: Clock,
      vip: Star,
      "at-risk": TrendingUp,
    };
    const Icon = icons[status];
    return (
      <Badge className={`${variants[status]} border flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.replace("-", " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Customer Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage customer accounts, orders, and relationships
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.totalCustomers}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.activeCustomers} active
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(stats.totalRevenue / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-gray-500 mt-1">All-time</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(stats.avgOrderValue / 1000).toFixed(1)}K
                </p>
                <p className="text-xs text-gray-500 mt-1">Per order</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow bg-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">VIP Customers</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.vipCustomers}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  {stats.atRiskCustomers} at risk
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="all">
            All Customers ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="top">Top Performers (5)</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity (5)</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* All Customers Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, email, or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="at-risk">At Risk</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={industryFilter}
                  onValueChange={setIndustryFilter}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Customers Table */}
          <Card className="hover:shadow-md transition-shadow bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Customer
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Contact
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Industry
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Orders
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Total Spent
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Rating
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Status
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {customer.name}
                          </div>
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {customer.company}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs">
                          {customer.industry}
                        </Badge>
                      </td>
                      <td className="p-4 font-semibold text-gray-900">
                        {customer.orders}
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-semibold text-gray-900">
                            ${customer.totalSpent.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            Avg: ${(customer.avgOrderValue / 1000).toFixed(1)}K
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold text-gray-900">
                            {customer.rating.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(customer.status)}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            <MessageSquare className="w-3 h-3" />
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

        {/* Top Performers Tab */}
        <TabsContent value="top" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Top 5 Customers by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {customer.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {customer.company} • {customer.industry}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>{customer.orders} orders</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {customer.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        ${(customer.totalSpent / 1000).toFixed(0)}K
                      </div>
                      <div className="text-sm text-gray-500">
                        Avg: ${(customer.avgOrderValue / 1000).toFixed(1)}K
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card className="hover:shadow-md transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {customer.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {customer.company}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Last order:{" "}
                        {new Date(customer.lastOrder).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {customer.orders}
                      </div>
                      <div className="text-xs text-gray-500">total orders</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Industry Breakdown */}
            <Card className="hover:shadow-md transition-shadow bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  Industry Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {industries.map((industry) => {
                    const count = customers.filter(
                      (c) => c.industry === industry,
                    ).length;
                    const percentage = (count / customers.length) * 100;
                    return (
                      <div key={industry} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">
                            {industry}
                          </span>
                          <span className="text-gray-600">
                            {count} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Customer Status */}
            <Card className="hover:shadow-md transition-shadow bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  Customer Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(["vip", "active", "at-risk", "inactive"] as const).map(
                    (status) => {
                      const count = customers.filter(
                        (c) => c.status === status,
                      ).length;
                      const revenue = customers
                        .filter((c) => c.status === status)
                        .reduce((sum, c) => sum + c.totalSpent, 0);
                      return (
                        <div
                          key={status}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusBadge(status)}
                            <span className="text-sm text-gray-600">
                              {count} customers
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              ${(revenue / 1000).toFixed(0)}K
                            </div>
                            <div className="text-xs text-gray-500">revenue</div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Add New Customer
            </DialogTitle>
            <DialogDescription>Create a new customer account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-900">Full Name *</Label>
                <Input
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <Label className="text-gray-900">Company *</Label>
                <Input
                  value={newCustomer.company}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, company: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  placeholder="Acme Manufacturing"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-900">Email *</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <Label className="text-gray-900">Phone *</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-900">Industry</Label>
              <Select
                value={newCustomer.industry}
                onValueChange={(value) =>
                  setNewCustomer({ ...newCustomer, industry: value })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-900">Address</Label>
              <Input
                value={newCustomer.address}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, address: e.target.value })
                }
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-900">City</Label>
                <Input
                  value={newCustomer.city}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, city: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  placeholder="Los Angeles"
                />
              </div>
              <div>
                <Label className="text-gray-900">State</Label>
                <Input
                  value={newCustomer.state}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, state: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  placeholder="CA"
                  maxLength={2}
                />
              </div>
              <div>
                <Label className="text-gray-900">ZIP Code</Label>
                <Input
                  value={newCustomer.zipcode}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, zipcode: e.target.value })
                  }
                  className="bg-white border-gray-300 text-gray-900 mt-1"
                  placeholder="90001"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomer}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Customer Details
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6 py-4">
              {/* Header Info */}
              <div className="flex items-start justify-between p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {selectedCustomer.name}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {selectedCustomer.company}
                  </p>
                  <div className="flex gap-3 mt-3">
                    {getStatusBadge(selectedCustomer.status)}
                    <Badge variant="outline">{selectedCustomer.industry}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Customer since</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {new Date(selectedCustomer.joined).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedCustomer.orders}
                    </div>
                    <div className="text-xs text-gray-600">Total Orders</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">
                      ${(selectedCustomer.totalSpent / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-gray-600">Total Spent</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <BarChart3 className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">
                      ${(selectedCustomer.avgOrderValue / 1000).toFixed(1)}K
                    </div>
                    <div className="text-xs text-gray-600">Avg Order</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedCustomer.rating.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">Rating</div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact & Payment Info */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">
                        {selectedCustomer.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">
                        {selectedCustomer.phone}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-900">
                        {selectedCustomer.address}
                        <br />
                        {selectedCustomer.city}, {selectedCustomer.state}{" "}
                        {selectedCustomer.zipcode}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Payment Terms</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Terms:</span>
                      <span className="font-semibold text-gray-900">
                        {selectedCustomer.paymentTerms}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Credit Limit:</span>
                      <span className="font-semibold text-gray-900">
                        ${selectedCustomer.creditLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Order:</span>
                      <span className="font-semibold text-gray-900">
                        {new Date(
                          selectedCustomer.lastOrder,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDetailsDialog(false)}
            >
              Close
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Edit className="w-4 h-4 mr-2" />
              Edit Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
