"use client";

import { Column, DataTable } from "@/components/ui/data-table";
import { apiClient } from "@/lib/api";
import { notify } from "@/lib/toast";
import { IGroupTolerance } from "@/types";
import React, { useEffect, useState } from "react";

const Page = () => {
  const [tolerances, setTolerances] = useState([]);
  const [isToleranceLoading, setIsToleranceLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [isEditToleranceModalOpen, setIsEditToleranceModalOpen] = useState(false);

  useEffect(() => {
    async function fetchTolerances() {
      try {
        const response = await apiClient.get("/tolerance");
        setTolerances(response.data);
      } catch (error) {
        console.error(error);
        notify.error("Failed to fetch tolerances");
      } finally {
        setIsToleranceLoading(false);
      }
    }

    fetchTolerances();
  }, []);

  const columns: Column<IGroupTolerance>[] = [
    {
      key: "id",
      header: "ID",
      render: (tolerance) => <span>{tolerance.id}</span>,
      hidden: true,
    },
    {
      key: "name",
      header: "Name",
      headerClassName:
        "py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900",
      cellClassName:
        "whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900",
      render: (tolerance) => (
        <div className="space-y-1">
          <span className="text-primary">{tolerance.name}</span>
        </div>
      ),
    },
    {
      key: "range_value",
      header: "Tolerance Value",
      render: (tolerance) => <> &plusmn; {tolerance.range_value}</>,
    },
    {
      key: "percentage",
      header: "Percentage",
      render: (tolerance) => <> {tolerance.percentage} %</>,
    },
    {
      key: "description",
      header: "Description",
      render: (tolerance) => <span>{tolerance.description}</span>,
    },
  ];
  return (
    <div className="p-6 space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materials</h1>
          <p className="mt-2 text-sm text-gray-700">
            Inspect material pricing, regional multipliers, and availability
            controls.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={tolerances}
        keyExtractor={(m) => m.id}
        isLoading={isToleranceLoading}
        emptyMessage={"No Tolerance was found"}
        actions={[]}
      />
    </div>
  );
};

export default Page;
