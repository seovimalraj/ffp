"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import {
  DocumentDuplicateIcon,
  ClockIcon,
  CheckCircleIcon,
  EyeIcon,
  CloudArrowUpIcon,
  CurrencyDollarIcon,
  UserIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";

interface CustomerQuote {
  id: string;
  quoteNumber: string;
  partName: string;
  material: string;
  quantity: number;
  surface: string;
  tolerance: string;
  leadTime: string;
  price: number;
  status: "pending" | "processing" | "quoted" | "approved" | "rejected";
  createdAt: string;
  validUntil: string;
  files: number;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  quoteId: string;
  status: "pending" | "processing" | "shipped" | "delivered";
  totalAmount: number;
  shippingAddress: string;
  estimatedDelivery: string;
  createdAt: string;
}

const CustomerPortal = () => {
  const [activeTab, setActiveTab] = useState("quotes");
  const [selectedQuote, setSelectedQuote] = useState<CustomerQuote | null>(
    null,
  );

  // Mock customer data
  const customer = {
    id: "CUST-001",
    name: "John Smith",
    company: "Aerospace Dynamics",
    email: "john.smith@aerospace.com",
    phone: "+1 (555) 123-4567",
    address: "123 Industrial Blvd, Manufacturing City, MC 12345",
    memberSince: "2023-03-15",
  };

  // Mock quotes data
  const quotes: CustomerQuote[] = [
    {
      id: "Q-2024-001",
      quoteNumber: "QT-24-001",
      partName: "Aerospace Bracket",
      material: "Aluminum 6061-T6",
      quantity: 50,
      surface: "Anodized",
      tolerance: 'Tight (±0.002")',
      leadTime: "5-7 Business Days",
      price: 12450,
      status: "quoted",
      createdAt: "2024-01-15T10:30:00Z",
      validUntil: "2024-02-15T10:30:00Z",
      files: 3,
    },
    {
      id: "Q-2024-002",
      quoteNumber: "QT-24-002",
      partName: "Medical Device Housing",
      material: "Stainless Steel 316",
      quantity: 25,
      surface: "As Machined",
      tolerance: 'Standard (±0.005")',
      leadTime: "2-3 Business Days",
      price: 8750,
      status: "processing",
      createdAt: "2024-01-14T14:15:00Z",
      validUntil: "2024-02-14T14:15:00Z",
      files: 2,
    },
    {
      id: "Q-2024-003",
      quoteNumber: "QT-24-003",
      partName: "Auto Part Cover",
      material: "Mild Steel",
      quantity: 100,
      surface: "Powder Coating",
      tolerance: 'Standard (±0.005")',
      leadTime: "5-7 Business Days",
      price: 15600,
      status: "approved",
      createdAt: "2024-01-13T11:20:00Z",
      validUntil: "2024-02-13T11:20:00Z",
      files: 4,
    },
  ];

  // Mock orders data
  const orders: CustomerOrder[] = [
    {
      id: "ORD-2024-001",
      orderNumber: "PO-24-001",
      quoteId: "Q-2024-003",
      status: "processing",
      totalAmount: 15600,
      shippingAddress: "123 Industrial Blvd, Manufacturing City, MC 12345",
      estimatedDelivery: "2024-01-25T00:00:00Z",
      createdAt: "2024-01-20T09:15:00Z",
    },
    {
      id: "ORD-2024-002",
      orderNumber: "PO-24-002",
      quoteId: "Q-2023-045",
      status: "delivered",
      totalAmount: 22400,
      shippingAddress: "123 Industrial Blvd, Manufacturing City, MC 12345",
      estimatedDelivery: "2024-01-10T00:00:00Z",
      createdAt: "2024-01-05T11:30:00Z",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "quoted":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "shipped":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <ClockIcon className="h-4 w-4" />;
      case "processing":
        return <DocumentDuplicateIcon className="h-4 w-4" />;
      case "quoted":
        return <DocumentDuplicateIcon className="h-4 w-4" />;
      case "approved":
        return <CheckCircleIcon className="h-4 w-4" />;
      case "shipped":
        return <DocumentDuplicateIcon className="h-4 w-4" />;
      case "delivered":
        return <CheckCircleIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 gap-9">
      {/* Customer Profile Header */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
          <h3 className="font-medium text-black dark:text-white">
            Customer Portal
          </h3>
        </div>
        <div className="p-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary bg-opacity-10">
                  <UserIcon className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-black dark:text-white">
                    {customer.name}
                  </h4>
                  <p className="text-body">{customer.company}</p>
                  <p className="text-sm text-meta-5">
                    Member since {formatDate(customer.memberSince)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="h-5 w-5 text-meta-5" />
                  <span className="text-black dark:text-white">
                    {customer.email}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <PhoneIcon className="h-5 w-5 text-meta-5" />
                  <span className="text-black dark:text-white">
                    {customer.phone}
                  </span>
                </div>
                <div className="flex items-center gap-3 md:col-span-2">
                  <BuildingOfficeIcon className="h-5 w-5 text-meta-5" />
                  <span className="text-black dark:text-white">
                    {customer.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="rounded-md border border-stroke p-4 dark:border-strokedark">
                <div className="flex items-center gap-3">
                  <DocumentDuplicateIcon className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-meta-5">Total Quotes</p>
                    <p className="text-lg font-bold text-black dark:text-white">
                      {quotes.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-stroke p-4 dark:border-strokedark">
                <div className="flex items-center gap-3">
                  <CurrencyDollarIcon className="h-6 w-6 text-meta-3" />
                  <div>
                    <p className="text-sm text-meta-5">Total Value</p>
                    <p className="text-lg font-bold text-black dark:text-white">
                      {formatCurrency(
                        quotes.reduce((sum, q) => sum + q.price, 0),
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("quotes")}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === "quotes"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          My Quotes
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === "orders"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          My Orders
        </button>
        <button
          onClick={() => setActiveTab("new-quote")}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === "new-quote"
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          Request New Quote
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "quotes" && (
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">
              My Quotes
            </h3>
          </div>

          <div className="p-7">
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-2 text-left dark:bg-meta-4">
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Quote #
                    </th>
                    <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                      Part Name
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Material
                    </th>
                    <th className="min-w-[100px] py-4 px-4 font-medium text-black dark:text-white">
                      Quantity
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Price
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Status
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Valid Until
                    </th>
                    <th className="py-4 px-4 font-medium text-black dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white font-medium">
                          {quote.quoteNumber}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white font-medium">
                          {quote.partName}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white">
                          {quote.material}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white">
                          {quote.quantity}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white font-medium">
                          {formatCurrency(quote.price)}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(quote.status)}`}
                        >
                          {getStatusIcon(quote.status)}
                          {quote.status.charAt(0).toUpperCase() +
                            quote.status.slice(1)}
                        </div>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white text-sm">
                          {formatDate(quote.validUntil)}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedQuote(quote)}
                            className="hover:text-primary"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {quote.status === "quoted" && (
                            <button
                              className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-opacity-90"
                              title="Accept Quote"
                            >
                              Accept
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">
              My Orders
            </h3>
          </div>

          <div className="p-7">
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-2 text-left dark:bg-meta-4">
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Order #
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Quote #
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Total Amount
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Status
                    </th>
                    <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                      Est. Delivery
                    </th>
                    <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                      Order Date
                    </th>
                    <th className="py-4 px-4 font-medium text-black dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white font-medium">
                          {order.orderNumber}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white">
                          {order.quoteId}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white font-medium">
                          {formatCurrency(order.totalAmount)}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(order.status)}`}
                        >
                          {getStatusIcon(order.status)}
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </div>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white text-sm">
                          {formatDate(order.estimatedDelivery)}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <p className="text-black dark:text-white text-sm">
                          {formatDate(order.createdAt)}
                        </p>
                      </td>
                      <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                        <div className="flex items-center space-x-2">
                          <button
                            className="hover:text-primary"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {order.status === "processing" && (
                            <button
                              className="px-3 py-1 bg-meta-5 text-white text-xs rounded hover:bg-opacity-90"
                              title="Track Order"
                            >
                              Track
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "new-quote" && (
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke py-4 px-7 dark:border-strokedark">
            <h3 className="font-medium text-black dark:text-white">
              Request New Quote
            </h3>
          </div>

          <div className="p-7">
            <div className="text-center py-12">
              <CloudArrowUpIcon className="mx-auto h-16 w-16 text-primary mb-4" />
              <h4 className="text-xl font-medium text-black dark:text-white mb-2">
                Ready to get a quote?
              </h4>
              <p className="text-body mb-6">
                Use our interactive quote wizard to upload your files and get
                instant pricing.
              </p>
              <button
                onClick={() => (window.location.href = "/widget")}
                className="inline-flex items-center justify-center rounded-md bg-primary py-4 px-10 text-center font-medium text-white hover:bg-opacity-90"
              >
                Start Quote Wizard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Details Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-w-2xl w-full mx-4 bg-white dark:bg-boxdark rounded-sm border border-stroke dark:border-strokedark">
            <div className="border-b border-stroke py-4 px-7 dark:border-strokedark flex justify-between items-center">
              <h3 className="font-medium text-black dark:text-white">
                Quote Details - {selectedQuote.quoteNumber}
              </h3>
              <button
                onClick={() => setSelectedQuote(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="p-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-medium text-black dark:text-white mb-4">
                    Part Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-gray-500">Part Name:</span>
                      <span className="ml-2 text-black dark:text-white font-medium">
                        {selectedQuote.partName}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Material:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {selectedQuote.material}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {selectedQuote.quantity}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Surface Finish:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {selectedQuote.surface}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tolerance:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {selectedQuote.tolerance}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Lead Time:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {selectedQuote.leadTime}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-black dark:text-white mb-4">
                    Pricing & Timeline
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-gray-500">Total Price:</span>
                      <span className="ml-2 text-black dark:text-white font-bold text-lg">
                        {formatCurrency(selectedQuote.price)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Unit Price:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {formatCurrency(
                          selectedQuote.price / selectedQuote.quantity,
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Valid Until:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {formatDate(selectedQuote.validUntil)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Files:</span>
                      <span className="ml-2 text-black dark:text-white">
                        {selectedQuote.files} uploaded
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span
                        className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(selectedQuote.status)}`}
                      >
                        {getStatusIcon(selectedQuote.status)}
                        {selectedQuote.status.charAt(0).toUpperCase() +
                          selectedQuote.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedQuote.status === "quoted" && (
                <div className="mt-6 pt-6 border-t border-stroke dark:border-strokedark">
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setSelectedQuote(null)}
                      className="px-4 py-2 border border-stroke rounded hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800"
                    >
                      Close
                    </button>
                    <button className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90">
                      Accept Quote
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPortal;
