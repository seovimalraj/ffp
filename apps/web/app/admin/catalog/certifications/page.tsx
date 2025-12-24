"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Award,
  Plus,
  Edit,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Shield,
  Calendar,
  AlertCircle,
  Users,
  Star,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Certification {
  id: string;
  name: string;
  code: string;
  category: "Quality" | "Industry" | "Safety" | "Environmental" | "Compliance";
  description: string;
  issuingBody: string;
  validityPeriod: number;
  required: boolean;
  status: "active" | "inactive";
  suppliersCount: number;
  verifiedCount: number;
  pendingCount: number;
  requirements: string[];
  industries: string[];
  priority: "high" | "medium" | "low";
}

export default function AdminCertificationsPage() {
  const [certifications, setCertifications] = useState<Certification[]>([
    {
      id: "CERT-001",
      name: "ISO 9001:2015",
      code: "ISO-9001",
      category: "Quality",
      description:
        "Quality Management System standard ensuring consistent product quality and customer satisfaction",
      issuingBody: "International Organization for Standardization",
      validityPeriod: 36,
      required: true,
      status: "active",
      suppliersCount: 12,
      verifiedCount: 10,
      pendingCount: 2,
      requirements: [
        "Quality management processes",
        "Customer focus",
        "Continuous improvement",
        "Documentation",
      ],
      industries: ["Manufacturing", "Aerospace", "Medical"],
      priority: "high",
    },
    {
      id: "CERT-002",
      name: "AS9100D",
      code: "AS-9100",
      category: "Industry",
      description:
        "Aerospace Quality Management System standard for aviation, space, and defense organizations",
      issuingBody: "Society of Automotive Engineers",
      validityPeriod: 36,
      required: false,
      status: "active",
      suppliersCount: 5,
      verifiedCount: 5,
      pendingCount: 0,
      requirements: [
        "Configuration management",
        "Risk management",
        "Product safety",
        "Counterfeit prevention",
      ],
      industries: ["Aerospace", "Defense"],
      priority: "high",
    },
    {
      id: "CERT-003",
      name: "ISO 13485:2016",
      code: "ISO-13485",
      category: "Industry",
      description:
        "Medical Devices Quality Management System ensuring safety and effectiveness",
      issuingBody: "International Organization for Standardization",
      validityPeriod: 36,
      required: false,
      status: "active",
      suppliersCount: 3,
      verifiedCount: 2,
      pendingCount: 1,
      requirements: [
        "Risk management",
        "Design controls",
        "Traceability",
        "Sterile processing",
      ],
      industries: ["Medical", "Healthcare"],
      priority: "high",
    },
    {
      id: "CERT-004",
      name: "ITAR Registered",
      code: "ITAR",
      category: "Compliance",
      description:
        "International Traffic in Arms Regulations compliance for defense-related manufacturing",
      issuingBody: "U.S. Department of State",
      validityPeriod: 12,
      required: false,
      status: "active",
      suppliersCount: 4,
      verifiedCount: 4,
      pendingCount: 0,
      requirements: [
        "U.S. citizenship verification",
        "Facility security",
        "Export controls",
        "Registration",
      ],
      industries: ["Defense", "Aerospace"],
      priority: "high",
    },
    {
      id: "CERT-005",
      name: "FDA Registered",
      code: "FDA-REG",
      category: "Compliance",
      description:
        "Food and Drug Administration registration for medical device manufacturing",
      issuingBody: "U.S. Food and Drug Administration",
      validityPeriod: 12,
      required: false,
      status: "active",
      suppliersCount: 2,
      verifiedCount: 2,
      pendingCount: 0,
      requirements: [
        "Facility registration",
        "Device listing",
        "QMS compliance",
        "Annual renewal",
      ],
      industries: ["Medical", "Healthcare"],
      priority: "medium",
    },
    {
      id: "CERT-006",
      name: "RoHS Compliant",
      code: "ROHS",
      category: "Environmental",
      description:
        "Restriction of Hazardous Substances directive compliance for electronics",
      issuingBody: "European Union",
      validityPeriod: 0,
      required: true,
      status: "active",
      suppliersCount: 15,
      verifiedCount: 14,
      pendingCount: 1,
      requirements: [
        "Material testing",
        "Documentation",
        "Substance limits compliance",
        "Supplier declarations",
      ],
      industries: ["Electronics", "Manufacturing", "Automotive"],
      priority: "medium",
    },
    {
      id: "CERT-007",
      name: "ISO 14001:2015",
      code: "ISO-14001",
      category: "Environmental",
      description:
        "Environmental Management System standard for reducing environmental impact",
      issuingBody: "International Organization for Standardization",
      validityPeriod: 36,
      required: false,
      status: "active",
      suppliersCount: 8,
      verifiedCount: 7,
      pendingCount: 1,
      requirements: [
        "Environmental policy",
        "Compliance obligations",
        "Emergency preparedness",
        "Performance evaluation",
      ],
      industries: ["Manufacturing", "Automotive", "Chemical"],
      priority: "low",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [newCert, setNewCert] = useState<Partial<Certification>>({
    category: "Quality",
    status: "active",
    required: false,
    priority: "medium",
    requirements: [],
    industries: [],
  });

  const filteredCertifications = certifications.filter((cert) => {
    const matchesSearch =
      cert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.issuingBody.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || cert.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || cert.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: certifications.length,
    active: certifications.filter((c) => c.status === "active").length,
    required: certifications.filter((c) => c.required).length,
    totalSuppliers: certifications.reduce(
      (sum, c) => sum + c.suppliersCount,
      0,
    ),
    verified: certifications.reduce((sum, c) => sum + c.verifiedCount, 0),
    pending: certifications.reduce((sum, c) => sum + c.pendingCount, 0),
  };

  const handleCreateCertification = () => {
    if (
      !newCert.name ||
      !newCert.code ||
      !newCert.description ||
      !newCert.issuingBody
    ) {
      alert("Please fill in all required fields");
      return;
    }

    const cert: Certification = {
      id: `CERT-${String(certifications.length + 1).padStart(3, "0")}`,
      name: newCert.name!,
      code: newCert.code!,
      category: (newCert.category as Certification["category"]) || "Quality",
      description: newCert.description!,
      issuingBody: newCert.issuingBody!,
      validityPeriod: newCert.validityPeriod || 36,
      required: newCert.required || false,
      status: "active",
      suppliersCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      requirements: newCert.requirements || [],
      industries: newCert.industries || [],
      priority: (newCert.priority as Certification["priority"]) || "medium",
    };

    setCertifications([...certifications, cert]);
    setShowCreateDialog(false);
    setNewCert({
      category: "Quality",
      status: "active",
      required: false,
      priority: "medium",
      requirements: [],
      industries: [],
    });
    alert(`✅ Certification "${cert.name}" created successfully!`);
  };

  const handleUpdateCertification = () => {
    if (!editingCert) return;

    setCertifications(
      certifications.map((c) => (c.id === editingCert.id ? editingCert : c)),
    );
    setEditingCert(null);
    alert(`✅ Certification "${editingCert.name}" updated successfully!`);
  };

  const handleDeleteCertification = (certId: string) => {
    const cert = certifications.find((c) => c.id === certId);
    if (confirm(`Are you sure you want to delete "${cert?.name}"?`)) {
      setCertifications(certifications.filter((c) => c.id !== certId));
      alert(`✅ Certification deleted successfully!`);
    }
  };

  const handleToggleStatus = (certId: string) => {
    setCertifications(
      certifications.map((c) =>
        c.id === certId
          ? { ...c, status: c.status === "active" ? "inactive" : "active" }
          : c,
      ),
    );
  };

  const handleToggleRequired = (certId: string) => {
    setCertifications(
      certifications.map((c) =>
        c.id === certId ? { ...c, required: !c.required } : c,
      ),
    );
  };

  const getPriorityBadge = (priority: Certification["priority"]) => {
    const variants = {
      high: { bg: "bg-red-100", text: "text-red-700", icon: AlertCircle },
      medium: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        icon: AlertCircle,
      },
      low: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
    };
    const variant = variants[priority];
    const Icon = variant.icon;
    return (
      <Badge
        className={`${variant.bg} ${variant.text} border-0 flex items-center gap-1 w-fit`}
      >
        <Icon size={12} />
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Certifications</h1>
          <p className="text-gray-600 mt-1">
            Manage supplier certifications, compliance, and verification
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Certification
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.total}
              </p>
            </div>
            <Award className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stats.active}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Required</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {stats.required}
              </p>
            </div>
            <Star className="w-10 h-10 text-orange-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Suppliers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalSuppliers}
              </p>
            </div>
            <Users className="w-10 h-10 text-purple-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Verified</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stats.verified}
              </p>
            </div>
            <Shield className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pending</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats.pending}
              </p>
            </div>
            <AlertCircle className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search certifications, codes, issuing bodies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white border-gray-300">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Quality">Quality</SelectItem>
              <SelectItem value="Industry">Industry</SelectItem>
              <SelectItem value="Safety">Safety</SelectItem>
              <SelectItem value="Environmental">Environmental</SelectItem>
              <SelectItem value="Compliance">Compliance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white border-gray-300">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Certifications Table */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="font-semibold">Certification</TableHead>
              <TableHead className="font-semibold">Code</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Issuing Body</TableHead>
              <TableHead className="font-semibold">Validity</TableHead>
              <TableHead className="font-semibold">Suppliers</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Priority</TableHead>
              <TableHead className="font-semibold text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCertifications.map((cert) => (
              <TableRow key={cert.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">{cert.name}</p>
                      {cert.required && (
                        <Badge className="bg-orange-100 text-orange-700 border-0 text-xs mt-1">
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm text-gray-600">
                  {cert.code}
                </TableCell>
                <TableCell>
                  <Badge className="bg-purple-100 text-purple-700 border-0">
                    {cert.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600 text-sm max-w-[200px] truncate">
                  {cert.issuingBody}
                </TableCell>
                <TableCell className="text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} className="text-gray-400" />
                    {cert.validityPeriod > 0
                      ? `${cert.validityPeriod} months`
                      : "Permanent"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p className="text-gray-900 font-medium">
                      {cert.suppliersCount} total
                    </p>
                    <p className="text-green-600 text-xs">
                      {cert.verifiedCount} verified
                    </p>
                    {cert.pendingCount > 0 && (
                      <p className="text-yellow-600 text-xs">
                        {cert.pendingCount} pending
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {cert.status === "active" ? (
                    <Badge className="bg-green-100 text-green-700 border-0 flex items-center gap-1 w-fit">
                      <CheckCircle size={12} />
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-700 border-0 flex items-center gap-1 w-fit">
                      <XCircle size={12} />
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{getPriorityBadge(cert.priority)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedCert(cert)}
                      className="hover:bg-gray-100"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingCert({ ...cert })}
                      className="hover:bg-gray-100"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCertification(cert.id)}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Certification Detail Modal */}
      {selectedCert && (
        <Dialog
          open={!!selectedCert}
          onOpenChange={() => setSelectedCert(null)}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Award className="text-blue-500" />
                {selectedCert.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex gap-2">
                <Badge
                  className={`${selectedCert.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} border-0`}
                >
                  {selectedCert.status}
                </Badge>
                <Badge className="bg-purple-100 text-purple-700 border-0">
                  {selectedCert.category}
                </Badge>
                {selectedCert.required && (
                  <Badge className="bg-orange-100 text-orange-700 border-0">
                    Required
                  </Badge>
                )}
                {getPriorityBadge(selectedCert.priority)}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Description
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedCert.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Certification Details
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Code:</span>{" "}
                      {selectedCert.code}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Issuing Body:</span>{" "}
                      {selectedCert.issuingBody}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Validity Period:</span>{" "}
                      {selectedCert.validityPeriod > 0
                        ? `${selectedCert.validityPeriod} months`
                        : "Permanent"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Supplier Statistics
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Total Suppliers:</span>{" "}
                      {selectedCert.suppliersCount}
                    </p>
                    <p className="text-sm text-green-600">
                      <span className="font-medium">Verified:</span>{" "}
                      {selectedCert.verifiedCount}
                    </p>
                    <p className="text-sm text-yellow-600">
                      <span className="font-medium">Pending:</span>{" "}
                      {selectedCert.pendingCount}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Requirements
                </p>
                <div className="space-y-2">
                  {selectedCert.requirements.map((req, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle
                        size={16}
                        className="text-green-500 mt-0.5 flex-shrink-0"
                      />
                      <p className="text-sm text-gray-700">{req}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Applicable Industries
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedCert.industries.map((industry, idx) => (
                    <Badge
                      key={idx}
                      className="bg-blue-100 text-blue-700 border-0"
                    >
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setEditingCert({ ...selectedCert })}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Edit size={16} className="mr-2" />
                  Edit Certification
                </Button>
                <Button
                  onClick={() => handleToggleRequired(selectedCert.id)}
                  variant="outline"
                  className="flex-1"
                >
                  {selectedCert.required ? "Make Optional" : "Make Required"}
                </Button>
                <Button
                  onClick={() => handleToggleStatus(selectedCert.id)}
                  variant="outline"
                  className="flex-1"
                >
                  {selectedCert.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit Certification Dialog */}
      {(showCreateDialog || editingCert) && (
        <Dialog
          open={showCreateDialog || !!editingCert}
          onOpenChange={() => {
            setShowCreateDialog(false);
            setEditingCert(null);
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editingCert
                  ? "Edit Certification"
                  : "Create New Certification"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Certification Name *</Label>
                  <Input
                    value={editingCert ? editingCert.name : newCert.name || ""}
                    onChange={(e) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            name: e.target.value,
                          })
                        : setNewCert({ ...newCert, name: e.target.value })
                    }
                    placeholder="e.g., ISO 9001:2015"
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Code *</Label>
                  <Input
                    value={editingCert ? editingCert.code : newCert.code || ""}
                    onChange={(e) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            code: e.target.value,
                          })
                        : setNewCert({ ...newCert, code: e.target.value })
                    }
                    placeholder="ISO-9001"
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  value={
                    editingCert
                      ? editingCert.description
                      : newCert.description || ""
                  }
                  onChange={(e) =>
                    editingCert
                      ? setEditingCert({
                          ...editingCert,
                          description: e.target.value,
                        })
                      : setNewCert({ ...newCert, description: e.target.value })
                  }
                  placeholder="Detailed description of the certification..."
                  rows={3}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Issuing Body *</Label>
                <Input
                  value={
                    editingCert
                      ? editingCert.issuingBody
                      : newCert.issuingBody || ""
                  }
                  onChange={(e) =>
                    editingCert
                      ? setEditingCert({
                          ...editingCert,
                          issuingBody: e.target.value,
                        })
                      : setNewCert({ ...newCert, issuingBody: e.target.value })
                  }
                  placeholder="International Organization for Standardization"
                  className="bg-white border-gray-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={
                      editingCert ? editingCert.category : newCert.category
                    }
                    onValueChange={(value) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            category: value as Certification["category"],
                          })
                        : setNewCert({
                            ...newCert,
                            category: value as Certification["category"],
                          })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Quality">Quality</SelectItem>
                      <SelectItem value="Industry">Industry</SelectItem>
                      <SelectItem value="Safety">Safety</SelectItem>
                      <SelectItem value="Environmental">
                        Environmental
                      </SelectItem>
                      <SelectItem value="Compliance">Compliance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={
                      editingCert ? editingCert.priority : newCert.priority
                    }
                    onValueChange={(value) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            priority: value as Certification["priority"],
                          })
                        : setNewCert({
                            ...newCert,
                            priority: value as Certification["priority"],
                          })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Validity (months)</Label>
                  <Input
                    type="number"
                    value={
                      editingCert
                        ? editingCert.validityPeriod
                        : newCert.validityPeriod || ""
                    }
                    onChange={(e) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            validityPeriod: parseInt(e.target.value),
                          })
                        : setNewCert({
                            ...newCert,
                            validityPeriod: parseInt(e.target.value),
                          })
                    }
                    placeholder="36"
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      editingCert ? editingCert.required : newCert.required
                    }
                    onChange={(e) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            required: e.target.checked,
                          })
                        : setNewCert({ ...newCert, required: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">
                    Required Certification
                  </span>
                </label>
              </div>

              <div>
                <Label>Requirements (comma-separated)</Label>
                <Textarea
                  value={
                    editingCert
                      ? editingCert.requirements.join(", ")
                      : newCert.requirements?.join(", ") || ""
                  }
                  onChange={(e) => {
                    const requirements = e.target.value
                      .split(",")
                      .map((r) => r.trim())
                      .filter((r) => r);
                    editingCert
                      ? setEditingCert({ ...editingCert, requirements })
                      : setNewCert({ ...newCert, requirements });
                  }}
                  placeholder="Quality management processes, Customer focus, Continuous improvement"
                  rows={2}
                  className="bg-white border-gray-300"
                />
              </div>

              <div>
                <Label>Applicable Industries (comma-separated)</Label>
                <Input
                  value={
                    editingCert
                      ? editingCert.industries.join(", ")
                      : newCert.industries?.join(", ") || ""
                  }
                  onChange={(e) => {
                    const industries = e.target.value
                      .split(",")
                      .map((i) => i.trim())
                      .filter((i) => i);
                    editingCert
                      ? setEditingCert({ ...editingCert, industries })
                      : setNewCert({ ...newCert, industries });
                  }}
                  placeholder="Manufacturing, Aerospace, Medical"
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            <DialogFooter>
              {editingCert ? (
                <>
                  <Button
                    onClick={handleUpdateCertification}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Update Certification
                  </Button>
                  <Button
                    onClick={() => setEditingCert(null)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleCreateCertification}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Create Certification
                  </Button>
                  <Button
                    onClick={() => setShowCreateDialog(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
