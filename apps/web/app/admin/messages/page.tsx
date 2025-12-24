"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  Search,
  User,
  Building2,
  Factory,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMessages,
  createMessage,
  markMessageAsRead,
  Message,
  getCustomers,
  getSuppliers,
} from "@/lib/mockDataStore";

const CURRENT_ADMIN_ID = "ADMIN-001";
const CURRENT_ADMIN_NAME = "Admin Team";

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({
    recipientRole: "customer" as "customer" | "supplier",
    recipientId: "",
    recipientName: "",
    subject: "",
    message: "",
    orderId: "",
  });

  const customers = getCustomers();
  const suppliers = getSuppliers();

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = () => {
    const allMessages = getMessages();
    setMessages(allMessages);
  };

  // Group messages by thread
  const threads = messages.reduce(
    (acc, msg) => {
      if (!acc[msg.thread_id]) {
        acc[msg.thread_id] = [];
      }
      acc[msg.thread_id].push(msg);
      return acc;
    },
    {} as Record<string, Message[]>,
  );

  // Get thread list with latest message
  const threadList = Object.entries(threads)
    .map(([threadId, msgs]) => {
      const sortedMsgs = [...msgs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const latestMsg = sortedMsgs[0];
      const unreadCount = msgs.filter(
        (m) => !m.read && m.recipient_role === "admin",
      ).length;

      return {
        threadId,
        messages: sortedMsgs,
        latestMessage: latestMsg,
        unreadCount,
        participant:
          latestMsg.sender_role === "admin"
            ? { name: latestMsg.recipient_name, role: latestMsg.recipient_role }
            : { name: latestMsg.sender_name, role: latestMsg.sender_role },
      };
    })
    .filter((thread) => {
      const matchesSearch =
        thread.latestMessage.subject
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        thread.participant.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesRole =
        roleFilter === "all" || thread.participant.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort(
      (a, b) =>
        new Date(b.latestMessage.created_at).getTime() -
        new Date(a.latestMessage.created_at).getTime(),
    );

  const selectedThreadData = selectedThread ? threads[selectedThread] : null;

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedThread) return;

    const threadMessages = threads[selectedThread];
    const firstMessage = threadMessages[0];

    const msg = createMessage({
      thread_id: selectedThread,
      sender_id: CURRENT_ADMIN_ID,
      sender_name: CURRENT_ADMIN_NAME,
      sender_role: "admin",
      recipient_id:
        firstMessage.sender_role === "admin"
          ? firstMessage.recipient_id
          : firstMessage.sender_id,
      recipient_name:
        firstMessage.sender_role === "admin"
          ? firstMessage.recipient_name
          : firstMessage.sender_name,
      recipient_role:
        firstMessage.sender_role === "admin"
          ? firstMessage.recipient_role
          : firstMessage.sender_role,
      subject: firstMessage.subject,
      message: newMessage,
      read: false,
      order_id: firstMessage.order_id,
    });

    setMessages([...messages, msg]);
    setNewMessage("");
  };

  const handleComposeMessage = () => {
    if (
      !composeForm.recipientId ||
      !composeForm.subject ||
      !composeForm.message
    ) {
      alert("Please fill in all required fields");
      return;
    }

    const threadId = `THREAD-${Date.now()}`;
    const msg = createMessage({
      thread_id: threadId,
      sender_id: CURRENT_ADMIN_ID,
      sender_name: CURRENT_ADMIN_NAME,
      sender_role: "admin",
      recipient_id: composeForm.recipientId,
      recipient_name: composeForm.recipientName,
      recipient_role: composeForm.recipientRole,
      subject: composeForm.subject,
      message: composeForm.message,
      read: false,
      order_id: composeForm.orderId || undefined,
    });

    setMessages([...messages, msg]);
    setShowCompose(false);
    setComposeForm({
      recipientRole: "customer",
      recipientId: "",
      recipientName: "",
      subject: "",
      message: "",
      orderId: "",
    });
    setSelectedThread(threadId);
  };

  const handleThreadClick = (threadId: string) => {
    setSelectedThread(threadId);
    // Mark all messages in thread as read
    threads[threadId].forEach((msg) => {
      if (!msg.read && msg.recipient_role === "admin") {
        markMessageAsRead(msg.id);
      }
    });
    loadMessages();
  };

  const getRoleIcon = (role: "customer" | "supplier" | "admin") => {
    switch (role) {
      case "customer":
        return <User className="w-4 h-4" />;
      case "supplier":
        return <Factory className="w-4 h-4" />;
      case "admin":
        return <Building2 className="w-4 h-4" />;
    }
  };

  const getRoleBadge = (role: "customer" | "supplier" | "admin") => {
    const variants = {
      customer: {
        bg: "bg-blue-500/10",
        text: "text-blue-600",
        border: "border-blue-500/20",
      },
      supplier: {
        bg: "bg-green-500/10",
        text: "text-green-600",
        border: "border-green-500/20",
      },
      admin: {
        bg: "bg-purple-500/10",
        text: "text-purple-600",
        border: "border-purple-500/20",
      },
    };
    const variant = variants[role];
    return (
      <Badge
        className={`${variant.bg} ${variant.text} ${variant.border} border px-2 py-1 flex items-center gap-1`}
      >
        {getRoleIcon(role)}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const unreadCount = messages.filter(
    (m) => !m.read && m.recipient_role === "admin",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">
            Communication hub for customers and suppliers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white px-3 py-1">
              {unreadCount} Unread
            </Badge>
          )}
          <Button
            onClick={() => setShowCompose(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4 mr-2" />
            New Message
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread List */}
        <Card className="lg:col-span-1 bg-white border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-300"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="customer">From Customers</SelectItem>
                <SelectItem value="supplier">From Suppliers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {threadList.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No messages found</p>
              </div>
            ) : (
              threadList.map((thread) => (
                <div
                  key={thread.threadId}
                  onClick={() => handleThreadClick(thread.threadId)}
                  className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
                    selectedThread === thread.threadId
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getRoleBadge(thread.participant.role)}
                      {thread.unreadCount > 0 && (
                        <Badge className="bg-red-500 text-white px-2 py-0.5 text-xs">
                          {thread.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <Clock className="w-3 h-3 text-gray-400" />
                  </div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">
                    {thread.participant.name}
                  </p>
                  <p className="text-sm text-gray-600 font-medium mb-1 truncate">
                    {thread.latestMessage.subject}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {thread.latestMessage.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(thread.latestMessage.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Message View */}
        <Card className="lg:col-span-2 bg-white border-gray-200 shadow-sm">
          {selectedThreadData ? (
            <>
              {/* Thread Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedThreadData[0].subject}
                  </h2>
                  {selectedThreadData[0].order_id && (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 border">
                      Order: {selectedThreadData[0].order_id}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getRoleBadge(
                    selectedThreadData[0].sender_role === "admin"
                      ? selectedThreadData[0].recipient_role
                      : selectedThreadData[0].sender_role,
                  )}
                  <span className="text-gray-600">
                    {selectedThreadData[0].sender_role === "admin"
                      ? selectedThreadData[0].recipient_name
                      : selectedThreadData[0].sender_name}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-6 space-y-4 overflow-y-auto max-h-[400px]">
                {selectedThreadData.map((msg) => {
                  const isAdmin = msg.sender_role === "admin";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] ${isAdmin ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"} rounded-lg p-4`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {getRoleIcon(msg.sender_role)}
                          <span className="font-semibold text-sm">
                            {msg.sender_name}
                          </span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                        <p
                          className={`text-xs mt-2 ${isAdmin ? "text-blue-100" : "text-gray-500"}`}
                        >
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div className="p-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 bg-white border-gray-300"
                    rows={3}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">
                No conversation selected
              </p>
              <p className="text-sm">
                Choose a thread from the left or start a new message
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white max-w-2xl w-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  New Message
                </h2>
                <Button variant="ghost" onClick={() => setShowCompose(false)}>
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Recipient Type
                  </label>
                  <Select
                    value={composeForm.recipientRole}
                    onValueChange={(value: "customer" | "supplier") =>
                      setComposeForm({
                        ...composeForm,
                        recipientRole: value,
                        recipientId: "",
                        recipientName: "",
                      })
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Recipient
                  </label>
                  <Select
                    value={composeForm.recipientId}
                    onValueChange={(value) => {
                      const list =
                        composeForm.recipientRole === "customer"
                          ? customers
                          : suppliers;
                      const selected = list.find((item) => item.id === value);
                      if (selected) {
                        setComposeForm({
                          ...composeForm,
                          recipientId: value,
                          recipientName: selected.name,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-white border-gray-300">
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {(composeForm.recipientRole === "customer"
                        ? customers
                        : suppliers
                      ).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Order ID (Optional)
                  </label>
                  <Input
                    value={composeForm.orderId}
                    onChange={(e) =>
                      setComposeForm({
                        ...composeForm,
                        orderId: e.target.value,
                      })
                    }
                    placeholder="e.g., ORD-2024-001"
                    className="bg-white border-gray-300"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Subject *
                  </label>
                  <Input
                    value={composeForm.subject}
                    onChange={(e) =>
                      setComposeForm({
                        ...composeForm,
                        subject: e.target.value,
                      })
                    }
                    placeholder="Message subject"
                    className="bg-white border-gray-300"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Message *
                  </label>
                  <Textarea
                    value={composeForm.message}
                    onChange={(e) =>
                      setComposeForm({
                        ...composeForm,
                        message: e.target.value,
                      })
                    }
                    placeholder="Type your message..."
                    className="bg-white border-gray-300"
                    rows={6}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={handleComposeMessage}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
                <Button
                  onClick={() => setShowCompose(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
