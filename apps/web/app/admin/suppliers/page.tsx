"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Factory,
  Search,
  Star,
  MapPin,
  CheckCircle,
  Clock,
  DollarSign,
  Award,
} from "lucide-react";
import { useState } from "react";

interface Supplier {
  id: string;
  name: string;
  location: string;
  rating: number;
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  revenue: number;
  capacity: number;
  onTimeDelivery: number;
  qualityScore: number;
  status: "active" | "inactive" | "pending";
  specialties: string[];
  certifications: string[];
}

const mockSuppliers: Supplier[] = [
  {
    id: "1",
    name: "Precision Parts Co",
    location: "San Francisco, CA",
    rating: 4.8,
    totalOrders: 245,
    completedOrders: 232,
    activeOrders: 13,
    revenue: 1250000,
    capacity: 85,
    onTimeDelivery: 94,
    qualityScore: 96,
    status: "active",
    specialties: ["CNC Machining", "5-Axis Milling", "Aluminum"],
    certifications: ["ISO 9001", "AS9100"],
  },
  {
    id: "2",
    name: "Advanced CNC Solutions",
    location: "Austin, TX",
    rating: 4.9,
    totalOrders: 312,
    completedOrders: 305,
    activeOrders: 7,
    revenue: 1850000,
    capacity: 72,
    onTimeDelivery: 97,
    qualityScore: 98,
    status: "active",
    specialties: ["Precision Turning", "Swiss Machining", "Medical Parts"],
    certifications: ["ISO 9001", "ISO 13485", "FDA"],
  },
  {
    id: "3",
    name: "MetalWorks Pro",
    location: "Chicago, IL",
    rating: 4.5,
    totalOrders: 189,
    completedOrders: 178,
    activeOrders: 11,
    revenue: 890000,
    capacity: 90,
    onTimeDelivery: 89,
    qualityScore: 92,
    status: "active",
    specialties: ["Sheet Metal", "Welding", "Fabrication"],
    certifications: ["ISO 9001", "ASME"],
  },
  {
    id: "4",
    name: "Titanium Works",
    location: "Seattle, WA",
    rating: 4.7,
    totalOrders: 156,
    completedOrders: 152,
    activeOrders: 4,
    revenue: 2100000,
    capacity: 65,
    onTimeDelivery: 95,
    qualityScore: 97,
    status: "active",
    specialties: ["Titanium Machining", "Aerospace Parts", "High-Precision"],
    certifications: ["ISO 9001", "AS9100", "NADCAP"],
  },
  {
    id: "5",
    name: "Sterile Manufacturing",
    location: "Boston, MA",
    rating: 4.9,
    totalOrders: 203,
    completedOrders: 198,
    activeOrders: 5,
    revenue: 1650000,
    capacity: 78,
    onTimeDelivery: 96,
    qualityScore: 99,
    status: "active",
    specialties: ["Medical Devices", "Cleanroom Manufacturing", "Implants"],
    certifications: ["ISO 9001", "ISO 13485", "FDA", "ISO 14644"],
  },
  {
    id: "6",
    name: "Rapid Prototyping Inc",
    location: "Los Angeles, CA",
    rating: 4.3,
    totalOrders: 98,
    completedOrders: 89,
    activeOrders: 9,
    revenue: 450000,
    capacity: 95,
    onTimeDelivery: 87,
    qualityScore: 90,
    status: "active",
    specialties: ["3D Printing", "Rapid Prototyping", "Low Volume"],
    certifications: ["ISO 9001"],
  },
];

export default function AdminSuppliersPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSuppliers = mockSuppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.specialties.some((s) =>
        s.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
  );

  const getRatingStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= Math.floor(rating)
                ? "text-yellow-500 fill-yellow-500"
                : star - 0.5 <= rating
                  ? "text-yellow-500 fill-yellow-500/50"
                  : "text-gray-600"
            }`}
          />
        ))}
        <span className="text-sm text-gray-400 ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const getStatusBadge = (status: Supplier["status"]) => {
    const variants = {
      active: "bg-green-500/10 text-green-500 border-green-500/20",
      inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    };
    return (
      <Badge className={`${variants[status]} border px-2 py-1`}>{status}</Badge>
    );
  };

  const getCapacityColor = (capacity: number) => {
    if (capacity >= 90) return "text-red-500";
    if (capacity >= 75) return "text-yellow-500";
    return "text-green-500";
  };

  const stats = {
    totalSuppliers: mockSuppliers.length,
    activeSuppliers: mockSuppliers.filter((s) => s.status === "active").length,
    avgRating: (
      mockSuppliers.reduce((sum, s) => sum + s.rating, 0) / mockSuppliers.length
    ).toFixed(1),
    totalRevenue: mockSuppliers.reduce((sum, s) => sum + s.revenue, 0),
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Suppliers</h1>
          <p className="text-gray-400 mt-1">
            Manage and monitor supplier performance
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Factory className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Suppliers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalSuppliers}
              </p>
            </div>
            <Factory className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Suppliers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.activeSuppliers}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Avg Rating</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.avgRating}
              </p>
            </div>
            <Star className="w-10 h-10 text-yellow-500 fill-yellow-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ${(stats.totalRevenue / 1000000).toFixed(1)}M
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-white border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search suppliers by name, location, or specialty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-gray-300 text-gray-900"
          />
        </div>
      </Card>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSuppliers.map((supplier) => (
          <Card
            key={supplier.id}
            className="bg-white border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Factory className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {supplier.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <MapPin className="w-3 h-3" />
                    {supplier.location}
                  </div>
                </div>
              </div>
              {getStatusBadge(supplier.status)}
            </div>

            {/* Rating */}
            <div className="mb-4">{getRatingStars(supplier.rating)}</div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-600">Total Orders</p>
                <p className="text-lg font-semibold text-gray-900">
                  {supplier.totalOrders}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Active</p>
                <p className="text-lg font-semibold text-blue-500">
                  {supplier.activeOrders}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Revenue</p>
                <p className="text-lg font-semibold text-green-500">
                  ${(supplier.revenue / 1000).toFixed(0)}K
                </p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">
                    Capacity Utilization
                  </span>
                  <span
                    className={`text-xs font-medium ${getCapacityColor(supplier.capacity)}`}
                  >
                    {supplier.capacity}%
                  </span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      supplier.capacity >= 90
                        ? "bg-red-500"
                        : supplier.capacity >= 75
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${supplier.capacity}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <Clock className="w-3 h-3" />
                    On-Time Delivery
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {supplier.onTimeDelivery}%
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <Award className="w-3 h-3" />
                    Quality Score
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {supplier.qualityScore}%
                  </p>
                </div>
              </div>
            </div>

            {/* Specialties */}
            <div className="mb-4">
              <p className="text-xs text-gray-600 mb-2">Specialties</p>
              <div className="flex flex-wrap gap-2">
                {supplier.specialties.map((specialty, idx) => (
                  <Badge
                    key={idx}
                    className="bg-blue-500/10 text-blue-500 border-blue-500/20 border text-xs"
                  >
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Certifications */}
            <div className="mb-4">
              <p className="text-xs text-gray-600 mb-2">Certifications</p>
              <div className="flex flex-wrap gap-2">
                {supplier.certifications.map((cert, idx) => (
                  <Badge
                    key={idx}
                    className="bg-green-500/10 text-green-500 border-green-500/20 border text-xs"
                  >
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-gray-300">
                View Details
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                Contact
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
