"use client";

import CustomerLayout from "@/components/CustomerLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CubeIcon,
  EyeIcon,
  TruckIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { useEffect } from "react";

export default function OrdersPage() {
  // Mock data for demonstration
  const orders = [
    {
      id: "ORD-001",
      title: "Aluminum CNC Part",
      status: "completed",
      createdAt: "2024-01-15",
      price: "$245.00",
      description:
        "Precision machined aluminum bracket for aerospace application",
    },
    {
      id: "ORD-002",
      title: "Steel Gear Housing",
      status: "in-progress",
      createdAt: "2024-01-12",
      price: "$1,250.00",
      description:
        "Heavy-duty steel gear housing with complex internal features",
    },
    {
      id: "ORD-003",
      title: "Plastic Prototype",
      status: "shipped",
      createdAt: "2024-01-10",
      price: "$89.50",
      description: "Rapid prototype for medical device component",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "shipped":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="h-4 w-4" />;
      case "in-progress":
        return <CubeIcon className="h-4 w-4" />;
      case "shipped":
        return <TruckIcon className="h-4 w-4" />;
      default:
        return <CubeIcon className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/orders");
        const data = await response.json();
        console.log(data);
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };
    fetchOrders();
  }, []);

  return (
    <CustomerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              My Orders
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track and manage your CNC machining orders
            </p>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{order.title}</CardTitle>
                  <Badge className={getStatusColor(order.status)}>
                    {getStatusIcon(order.status)}
                    <span className="ml-1">{order.status}</span>
                  </Badge>
                </div>
                <CardDescription>{order.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Order ID:
                    </span>
                    <span className="font-medium">{order.id}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Price:
                    </span>
                    <span className="font-bold text-lg text-primary">
                      {order.price}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Ordered:
                    </span>
                    <span>{order.createdAt}</span>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    <EyeIcon className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {orders.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No orders yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                Your completed orders will appear here
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CubeIcon className="h-8 w-8 text-primary mr-3" />
                <div>
                  <p className="text-2xl font-bold">8</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Orders
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">5</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Completed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CubeIcon className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">2</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    In Progress
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TruckIcon className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">1</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Shipped
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}
