"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Award,
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Shield,
  Clock,
  RefreshCw,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SupplierCertification {
  id: string;
  certType: string;
  certNumber: string;
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
  status: "active" | "pending_verification" | "expired" | "expiring_soon";
  verificationStatus: "verified" | "pending" | "rejected";
  documentUrl?: string;
  notes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export default function SupplierCertificationsPage() {
  const [certifications, setCertifications] = useState<SupplierCertification[]>(
    [
      {
        id: "CERT-001",
        certType: "ISO 9001:2015",
        certNumber: "ISO-9001-2024-123456",
        issuingBody: "International Organization for Standardization",
        issueDate: new Date(
          Date.now() - 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        expiryDate: new Date(
          Date.now() + 730 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "active",
        verificationStatus: "verified",
        documentUrl: "/documents/iso-9001-cert.pdf",
        notes: "Annual audit completed successfully",
        verifiedBy: "Admin Team",
        verifiedAt: new Date(
          Date.now() - 300 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        id: "CERT-002",
        certType: "AS9100D",
        certNumber: "AS-9100-2024-789012",
        issuingBody: "SAE International",
        issueDate: new Date(
          Date.now() - 180 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        expiryDate: new Date(
          Date.now() + 900 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "active",
        verificationStatus: "verified",
        documentUrl: "/documents/as9100-cert.pdf",
        verifiedBy: "Admin Team",
        verifiedAt: new Date(
          Date.now() - 150 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        id: "CERT-003",
        certType: "ISO 13485:2016",
        certNumber: "ISO-13485-2024-345678",
        issuingBody: "International Organization for Standardization",
        issueDate: new Date(
          Date.now() - 60 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        expiryDate: new Date(
          Date.now() + 1035 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "active",
        verificationStatus: "pending",
        documentUrl: "/documents/iso-13485-cert.pdf",
        notes: "Awaiting verification by compliance team",
      },
      {
        id: "CERT-004",
        certType: "ITAR Registration",
        certNumber: "ITAR-2024-567890",
        issuingBody: "U.S. Department of State",
        issueDate: new Date(
          Date.now() - 300 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        expiryDate: new Date(
          Date.now() + 65 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "expiring_soon",
        verificationStatus: "verified",
        documentUrl: "/documents/itar-reg.pdf",
        notes: "Renewal in progress",
        verifiedBy: "Admin Team",
        verifiedAt: new Date(
          Date.now() - 290 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    ],
  );

  const [selectedCert, setSelectedCert] =
    useState<SupplierCertification | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingCert, setEditingCert] = useState<SupplierCertification | null>(
    null,
  );
  const [newCert, setNewCert] = useState<Partial<SupplierCertification>>({
    status: "active",
    verificationStatus: "pending",
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const stats = {
    total: certifications.length,
    active: certifications.filter((c) => c.status === "active").length,
    verified: certifications.filter((c) => c.verificationStatus === "verified")
      .length,
    expiringSoon: certifications.filter((c) => c.status === "expiring_soon")
      .length,
    pending: certifications.filter((c) => c.verificationStatus === "pending")
      .length,
  };

  const getStatusBadge = (status: SupplierCertification["status"]) => {
    const variants = {
      active: {
        bg: "bg-green-100",
        text: "text-green-700",
        icon: CheckCircle,
        label: "Active",
      },
      pending_verification: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        icon: Clock,
        label: "Pending Verification",
      },
      expired: {
        bg: "bg-red-100",
        text: "text-red-700",
        icon: XCircle,
        label: "Expired",
      },
      expiring_soon: {
        bg: "bg-orange-100",
        text: "text-orange-700",
        icon: AlertTriangle,
        label: "Expiring Soon",
      },
    };
    const variant = variants[status];
    const Icon = variant.icon;
    return (
      <Badge
        className={`${variant.bg} ${variant.text} border-0 flex items-center gap-1 w-fit`}
      >
        <Icon size={12} />
        {variant.label}
      </Badge>
    );
  };

  const getVerificationBadge = (
    status: SupplierCertification["verificationStatus"],
  ) => {
    const variants = {
      verified: {
        bg: "bg-green-100",
        text: "text-green-700",
        icon: Shield,
        label: "Verified",
      },
      pending: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        icon: Clock,
        label: "Pending Review",
      },
      rejected: {
        bg: "bg-red-100",
        text: "text-red-700",
        icon: XCircle,
        label: "Rejected",
      },
    };
    const variant = variants[status];
    const Icon = variant.icon;
    return (
      <Badge
        className={`${variant.bg} ${variant.text} border-0 flex items-center gap-1 w-fit`}
      >
        <Icon size={12} />
        {variant.label}
      </Badge>
    );
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const days = Math.floor(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return days;
  };

  const handleUploadCertification = () => {
    if (
      !newCert.certType ||
      !newCert.certNumber ||
      !newCert.issuingBody ||
      !newCert.issueDate ||
      !newCert.expiryDate
    ) {
      alert("Please fill in all required fields");
      return;
    }

    if (!uploadedFile) {
      alert("Please upload a certificate document");
      return;
    }

    const cert: SupplierCertification = {
      id: `CERT-${String(certifications.length + 1).padStart(3, "0")}`,
      certType: newCert.certType!,
      certNumber: newCert.certNumber!,
      issuingBody: newCert.issuingBody!,
      issueDate: newCert.issueDate!,
      expiryDate: newCert.expiryDate!,
      status: "pending_verification",
      verificationStatus: "pending",
      documentUrl: `/documents/${uploadedFile.name}`,
      notes: newCert.notes,
    };

    setCertifications([...certifications, cert]);
    setShowUploadDialog(false);
    setNewCert({ status: "active", verificationStatus: "pending" });
    setUploadedFile(null);
    alert(
      `✅ Certification uploaded successfully! It will be reviewed by the admin team.`,
    );
  };

  const handleUpdateCertification = () => {
    if (!editingCert) return;

    setCertifications(
      certifications.map((c) => (c.id === editingCert.id ? editingCert : c)),
    );
    setEditingCert(null);
    alert(`✅ Certification updated successfully!`);
  };

  const handleDeleteCertification = (certId: string) => {
    const cert = certifications.find((c) => c.id === certId);
    if (
      confirm(
        `Are you sure you want to delete certification "${cert?.certType}"?`,
      )
    ) {
      setCertifications(certifications.filter((c) => c.id !== certId));
      alert(`✅ Certification deleted successfully!`);
    }
  };

  const handleRenewCertification = (certId: string) => {
    const cert = certifications.find((c) => c.id === certId);
    if (cert) {
      setNewCert({
        certType: cert.certType,
        issuingBody: cert.issuingBody,
        notes: `Renewal of ${cert.certNumber}`,
        status: "active",
        verificationStatus: "pending",
      });
      setShowUploadDialog(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Certifications</h1>
          <p className="text-gray-600 mt-1">
            Manage your certifications and compliance documents
          </p>
        </div>
        <Button
          onClick={() => setShowUploadDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Certification
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.total}
              </p>
            </div>
            <Award className="w-10 h-10 text-emerald-500" />
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
              <p className="text-gray-600 text-sm">Verified</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">
                {stats.verified}
              </p>
            </div>
            <Shield className="w-10 h-10 text-emerald-500" />
          </div>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Expiring Soon</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {stats.expiringSoon}
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500" />
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
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Certifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {certifications.map((cert) => {
          const daysUntilExpiry = getDaysUntilExpiry(cert.expiryDate);
          return (
            <Card
              key={cert.id}
              className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Award size={20} className="text-emerald-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {cert.certType}
                      </h3>
                    </div>
                    <p className="text-sm font-mono text-gray-600 mb-2">
                      {cert.certNumber}
                    </p>
                    <p className="text-sm text-gray-600">{cert.issuingBody}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedCert(cert)}
                      className="hover:bg-gray-100"
                    >
                      <Eye size={16} />
                    </Button>
                    {cert.documentUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          alert(`Downloading: ${cert.documentUrl}`)
                        }
                        className="hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Download size={16} />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    {getStatusBadge(cert.status)}
                    {getVerificationBadge(cert.verificationStatus)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Issue Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(cert.issueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Expiry Date</p>
                      <p
                        className={`font-medium ${daysUntilExpiry < 90 ? "text-orange-600" : "text-gray-900"}`}
                      >
                        {new Date(cert.expiryDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {daysUntilExpiry < 90 && daysUntilExpiry > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertTriangle
                        size={16}
                        className="text-orange-600 flex-shrink-0"
                      />
                      <p className="text-sm text-orange-700">
                        Expires in {daysUntilExpiry} days
                      </p>
                    </div>
                  )}

                  {cert.verificationStatus === "pending" && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
                      <Clock
                        size={16}
                        className="text-yellow-600 flex-shrink-0"
                      />
                      <p className="text-sm text-yellow-700">
                        Awaiting admin verification
                      </p>
                    </div>
                  )}

                  {cert.verificationStatus === "verified" &&
                    cert.verifiedBy && (
                      <div className="text-xs text-gray-500">
                        Verified by {cert.verifiedBy} on{" "}
                        {new Date(cert.verifiedAt!).toLocaleDateString()}
                      </div>
                    )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingCert({ ...cert })}
                    className="flex-1 hover:bg-gray-100"
                  >
                    <Edit size={16} className="mr-1" />
                    Edit
                  </Button>
                  {(cert.status === "expiring_soon" ||
                    cert.status === "expired") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRenewCertification(cert.id)}
                      className="flex-1 hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <RefreshCw size={16} className="mr-1" />
                      Renew
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteCertification(cert.id)}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Certification Detail Modal */}
      {selectedCert && (
        <Dialog
          open={!!selectedCert}
          onOpenChange={() => setSelectedCert(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Award className="text-emerald-600" />
                {selectedCert.certType}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex gap-2">
                {getStatusBadge(selectedCert.status)}
                {getVerificationBadge(selectedCert.verificationStatus)}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Certification Details
                </p>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Certificate Number:</span>{" "}
                    {selectedCert.certNumber}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Issuing Body:</span>{" "}
                    {selectedCert.issuingBody}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Issue Date:</span>{" "}
                    {new Date(selectedCert.issueDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Expiry Date:</span>{" "}
                    {new Date(selectedCert.expiryDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Days Until Expiry:</span>{" "}
                    {getDaysUntilExpiry(selectedCert.expiryDate)} days
                  </p>
                </div>
              </div>

              {selectedCert.verificationStatus === "verified" &&
                selectedCert.verifiedBy && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-2">
                      Verification Details
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Verified By:</span>{" "}
                        {selectedCert.verifiedBy}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Verification Date:</span>{" "}
                        {new Date(
                          selectedCert.verifiedAt!,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

              {selectedCert.notes && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Notes
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {selectedCert.notes}
                  </p>
                </div>
              )}

              {selectedCert.documentUrl && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    Document
                  </p>
                  <div className="flex items-center gap-2 bg-gray-50 p-3 rounded">
                    <FileText size={20} className="text-gray-600" />
                    <span className="text-sm font-mono flex-1">
                      {selectedCert.documentUrl}
                    </span>
                    <Button
                      size="sm"
                      onClick={() =>
                        alert(`Downloading: ${selectedCert.documentUrl}`)
                      }
                    >
                      <Download size={16} className="mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setEditingCert({ ...selectedCert })}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Edit size={16} className="mr-2" />
                  Edit
                </Button>
                {selectedCert.documentUrl && (
                  <Button
                    onClick={() =>
                      alert(`Downloading: ${selectedCert.documentUrl}`)
                    }
                    variant="outline"
                    className="flex-1"
                  >
                    <Download size={16} className="mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Upload/Edit Certification Dialog */}
      {(showUploadDialog || editingCert) && (
        <Dialog
          open={showUploadDialog || !!editingCert}
          onOpenChange={() => {
            setShowUploadDialog(false);
            setEditingCert(null);
            setUploadedFile(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editingCert
                  ? "Edit Certification"
                  : "Upload New Certification"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Certification Type *</Label>
                <Select
                  value={editingCert ? editingCert.certType : newCert.certType}
                  onValueChange={(value) =>
                    editingCert
                      ? setEditingCert({ ...editingCert, certType: value })
                      : setNewCert({ ...newCert, certType: value })
                  }
                >
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="Select certification type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ISO 9001:2015">ISO 9001:2015</SelectItem>
                    <SelectItem value="AS9100D">AS9100D</SelectItem>
                    <SelectItem value="ISO 13485:2016">
                      ISO 13485:2016
                    </SelectItem>
                    <SelectItem value="ITAR Registration">
                      ITAR Registration
                    </SelectItem>
                    <SelectItem value="FDA Registered">
                      FDA Registered
                    </SelectItem>
                    <SelectItem value="RoHS Compliant">
                      RoHS Compliant
                    </SelectItem>
                    <SelectItem value="ISO 14001:2015">
                      ISO 14001:2015
                    </SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Certificate Number *</Label>
                <Input
                  value={
                    editingCert
                      ? editingCert.certNumber
                      : newCert.certNumber || ""
                  }
                  onChange={(e) =>
                    editingCert
                      ? setEditingCert({
                          ...editingCert,
                          certNumber: e.target.value,
                        })
                      : setNewCert({ ...newCert, certNumber: e.target.value })
                  }
                  placeholder="ISO-9001-2024-123456"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Issue Date *</Label>
                  <Input
                    type="date"
                    value={
                      editingCert
                        ? editingCert.issueDate.split("T")[0]
                        : newCert.issueDate?.split("T")[0] || ""
                    }
                    onChange={(e) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            issueDate: new Date(e.target.value).toISOString(),
                          })
                        : setNewCert({
                            ...newCert,
                            issueDate: new Date(e.target.value).toISOString(),
                          })
                    }
                    className="bg-white border-gray-300"
                  />
                </div>
                <div>
                  <Label>Expiry Date *</Label>
                  <Input
                    type="date"
                    value={
                      editingCert
                        ? editingCert.expiryDate.split("T")[0]
                        : newCert.expiryDate?.split("T")[0] || ""
                    }
                    onChange={(e) =>
                      editingCert
                        ? setEditingCert({
                            ...editingCert,
                            expiryDate: new Date(e.target.value).toISOString(),
                          })
                        : setNewCert({
                            ...newCert,
                            expiryDate: new Date(e.target.value).toISOString(),
                          })
                    }
                    className="bg-white border-gray-300"
                  />
                </div>
              </div>

              {!editingCert && (
                <div>
                  <Label>Upload Certificate Document *</Label>
                  <div className="mt-2">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span>{" "}
                          or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          PDF, JPG, PNG (MAX. 10MB)
                        </p>
                        {uploadedFile && (
                          <p className="mt-2 text-sm font-medium text-emerald-600">
                            ✓ {uploadedFile.name}
                          </p>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setUploadedFile(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={
                    editingCert ? editingCert.notes || "" : newCert.notes || ""
                  }
                  onChange={(e) =>
                    editingCert
                      ? setEditingCert({
                          ...editingCert,
                          notes: e.target.value,
                        })
                      : setNewCert({ ...newCert, notes: e.target.value })
                  }
                  placeholder="Additional information about this certification..."
                  rows={3}
                  className="bg-white border-gray-300"
                />
              </div>
            </div>

            <DialogFooter>
              {editingCert ? (
                <>
                  <Button
                    onClick={handleUpdateCertification}
                    className="bg-emerald-600 hover:bg-emerald-700"
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
                    onClick={handleUploadCertification}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Upload size={16} className="mr-2" />
                    Upload Certification
                  </Button>
                  <Button
                    onClick={() => setShowUploadDialog(false)}
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
