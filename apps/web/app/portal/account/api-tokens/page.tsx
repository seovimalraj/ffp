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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeftIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import type {
  ApiToken,
  ApiTokensListResponse,
  ApiTokenFormData,
} from "@/types/order";
import { trackEvent } from "@/lib/analytics/posthog";

const SCOPE_OPTIONS = [
  { value: "quotes:read", label: "Read Quotes" },
  { value: "quotes:write", label: "Write Quotes" },
  { value: "orders:read", label: "Read Orders" },
  { value: "orders:write", label: "Write Orders" },
  { value: "files:read", label: "Read Files" },
  { value: "files:write", label: "Write Files" },
];

const ITEMS_PER_PAGE = 25;

export default function ApiTokensPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [_total, setTotal] = useState(0);
  const [page, _setPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [createdToken, setCreatedToken] = useState<{
    token: string;
    tokenData: ApiToken;
  } | null>(null);
  const [formData, setFormData] = useState<ApiTokenFormData>({
    name: "",
    scopes: [],
  });
  const [creating, setCreating] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Load tokens
  useEffect(() => {
    loadTokens();
  }, [page]);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiTokensListResponse>(
        `/org/tokens?page=${page}&limit=${ITEMS_PER_PAGE}`,
      );
      setTokens(response.data.tokens);
      setTotal(response.data.total);
      trackEvent("api_tokens_view");
    } catch (error: any) {
      console.error("Error loading tokens:", error);
      toast.error("Failed to load API tokens");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async () => {
    try {
      setCreating(true);
      const response = await api.post<{ token: string; token_data: ApiToken }>(
        "/org/tokens",
        formData,
      );

      setCreatedToken({
        token: response.data.token,
        tokenData: response.data.token_data,
      });
      setShowCreateDialog(false);
      setShowTokenDialog(true);
      trackEvent("api_token_created", { scopes: formData.scopes });

      // Reset form
      setFormData({ name: "", scopes: [] });

      // Refresh list
      await loadTokens();
    } catch (error: any) {
      console.error("Error creating token:", error);
      toast.error(error.response?.data?.message || "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const handleRotateToken = async (tokenId: string) => {
    try {
      const response = await api.post<{ token: string; token_data: ApiToken }>(
        `/org/tokens/${tokenId}/rotate`,
      );

      setCreatedToken({
        token: response.data.token,
        tokenData: response.data.token_data,
      });
      setShowTokenDialog(true);
      trackEvent("api_token_rotated", { token_id: tokenId });

      await loadTokens();
    } catch (error: any) {
      console.error("Error rotating token:", error);
      toast.error("Failed to rotate token");
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this token? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await api.delete(`/org/tokens/${tokenId}`);
      toast.success("Token revoked successfully");
      trackEvent("api_token_revoked", { token_id: tokenId });
      await loadTokens();
    } catch (error: any) {
      console.error("Error revoking token:", error);
      toast.error("Failed to revoke token");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const formatLastUsed = (dateString?: string) => {
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

  const maskToken = (token: string) => {
    if (token.length <= 8) return token;
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
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
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Token</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert>
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <AlertDescription>
                    Treat tokens like passwords. Scopes restrict access to
                    specific resources.
                  </AlertDescription>
                </Alert>
                <div>
                  <Label htmlFor="token-name">Token Name</Label>
                  <Input
                    id="token-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="My API Token"
                  />
                </div>
                <div>
                  <Label htmlFor="token-scopes">Scopes</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (!formData.scopes.includes(value)) {
                        setFormData({
                          ...formData,
                          scopes: [...formData.scopes, value],
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add scope..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.scopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {SCOPE_OPTIONS.find((s) => s.value === scope)?.label ||
                          scope}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              scopes: formData.scopes.filter(
                                (s) => s !== scope,
                              ),
                            })
                          }
                        >
                          ×
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateToken}
                    disabled={
                      creating || !formData.name || formData.scopes.length === 0
                    }
                  >
                    {creating ? "Creating..." : "Create Token"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Tokens</h1>
          <p className="text-gray-600 mt-2">
            Create and manage API tokens for programmatic access to your
            account.
          </p>
        </div>

        {/* Security Notice */}
        <Alert>
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> API tokens provide full access to
            your account. Store them securely and rotate regularly. Never share
            them in public repositories or logs.
          </AlertDescription>
        </Alert>

        {/* Tokens Table */}
        <Card>
          <CardHeader>
            <CardTitle>Active Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Token Prefix</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {token.scopes.slice(0, 2).map((scope) => (
                          <Badge
                            key={scope}
                            variant="outline"
                            className="text-xs"
                          >
                            {SCOPE_OPTIONS.find((s) => s.value === scope)
                              ?.label || scope}
                          </Badge>
                        ))}
                        {token.scopes.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{token.scopes.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {new Date(token.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatLastUsed(token.last_used_at)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {token.prefix}
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
                            onClick={() => handleRotateToken(token.id)}
                          >
                            <ArrowPathIcon className="w-4 h-4 mr-2" />
                            Rotate Token
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRevokeToken(token.id)}
                            className="text-red-600"
                          >
                            <TrashIcon className="w-4 h-4 mr-2" />
                            Revoke Token
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {tokens.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No API tokens found. Create your first token to get started with
                the API.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Token Display Dialog */}
        <Dialog
          open={showTokenDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowTokenDialog(false);
              setCreatedToken(null);
              setShowFullToken(false);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                Token Created Successfully
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <ExclamationTriangleIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Copy this token now. You won't be
                  able to see it again!
                </AlertDescription>
              </Alert>

              {createdToken && (
                <div className="space-y-4">
                  <div>
                    <Label>Token Name</Label>
                    <p className="font-medium">{createdToken.tokenData.name}</p>
                  </div>

                  <div>
                    <Label>Token Value</Label>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border font-mono text-sm">
                      <span className="flex-1">
                        {showFullToken
                          ? createdToken.token
                          : maskToken(createdToken.token)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFullToken(!showFullToken)}
                      >
                        {showFullToken ? (
                          <EyeSlashIcon className="w-4 h-4" />
                        ) : (
                          <EyeIcon className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(createdToken.token)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Scopes</Label>
                    <div className="flex flex-wrap gap-2">
                      {createdToken.tokenData.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary">
                          {SCOPE_OPTIONS.find((s) => s.value === scope)
                            ?.label || scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setShowTokenDialog(false);
                    setCreatedToken(null);
                    setShowFullToken(false);
                  }}
                >
                  I've Saved My Token
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
