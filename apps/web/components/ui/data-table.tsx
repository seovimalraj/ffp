"use client";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import {
  EllipsisVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/20/solid";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Column<T> = {
  key: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  hidden?: boolean;
};

export type Action<T> = {
  label: string | ((row: T) => string);
  onClick: (row: T) => void;
  icon?: ReactNode | ((row: T) => ReactNode);
  className?: string;
  disabled?: boolean | ((row: T) => boolean);
};

type SortComparator<T> = (a: T, b: T, column: Column<T>) => number;

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  actions?: Action<T>[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  sortComparator?: SortComparator<T>;
  searchableColumns?: string[];
  onFilterChange?: (filtered: T[]) => void;
  pageSize?: number;
  selectable?: boolean; // added selectable flag
  onSelectionChange?: (selected: T[]) => void; // callback for selection changes
  numbering?: boolean; // show row numbers
};

export function DataTable<T>({
  columns,
  data,
  actions,
  keyExtractor,
  emptyMessage = "No data found.",
  isLoading = false,
  loadingMessage = "Loading...",
  sortComparator,
  searchableColumns,
  onFilterChange,
  pageSize = 10,
  selectable = false, // default to false
  onSelectionChange,
  numbering = false, // default to false
}: DataTableProps<T>) {
  // Filter out hidden columns
  const visibleColumns = columns.filter((col) => !col.hidden);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [searchQuery, _setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set(),
  ); // added selection state

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0;

    const column = columns.find((col) => col.key === sortConfig.key);
    if (!column || !column.sortable) return 0;

    let result = 0;
    if (sortComparator) {
      result = sortComparator(a, b, column);
    } else {
      const aValue = (a as Record<string, unknown>)[column.key];
      const bValue = (b as Record<string, unknown>)[column.key];

      if (typeof aValue === "string" && typeof bValue === "string") {
        result = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        result = aValue - bValue;
      } else {
        result = String(aValue).localeCompare(String(bValue));
      }
    }

    return sortConfig.direction === "asc" ? result : -result;
  });

  const handleSort = (columnKey: string) => {
    setSortConfig((prev) => {
      if (prev?.key === columnKey) {
        return prev.direction === "asc"
          ? { key: columnKey, direction: "desc" }
          : null;
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const filteredData = searchQuery
    ? sortedData.filter((row) => {
        if (!searchableColumns || searchableColumns.length === 0) return true;

        return searchableColumns.some((columnKey) => {
          const value = (row as Record<string, unknown>)[columnKey];
          return String(value)
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        });
      })
    : sortedData;

  useEffect(() => {
    onFilterChange?.(filteredData);
    setCurrentPage(1);
  }, [filteredData, onFilterChange]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleSelectRow = (rowKey: string | number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowKey)) {
      newSelected.delete(rowKey);
    } else {
      newSelected.add(rowKey);
    }
    setSelectedRows(newSelected);
    const selectedData = data.filter((row) =>
      newSelected.has(keyExtractor(row)),
    );
    onSelectionChange?.(selectedData);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set(selectedRows);
      paginatedData.forEach((row) => {
        newSelected.add(keyExtractor(row));
      });
      setSelectedRows(newSelected);
      const selectedData = data.filter((row) =>
        newSelected.has(keyExtractor(row)),
      );
      onSelectionChange?.(selectedData);
    }
  };

  const totalColumns =
    visibleColumns.length +
    (actions?.length ? 1 : 0) +
    (selectable ? 1 : 0) +
    (numbering ? 1 : 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted border-b border-border">
          <tr>
            {numbering && (
              <th
                scope="col"
                className="px-4 py-3 w-12 text-left text-xs font-semibold text-foreground tracking-wide"
              >
                #
              </th>
            )}
            {selectable && (
              <th scope="col" className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={
                    selectedRows.size === paginatedData.length &&
                    paginatedData.length > 0
                  }
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-border"
                  aria-label="Select all rows"
                />
              </th>
            )}
            {visibleColumns.map((col, idx) => (
              <th
                key={col.key}
                scope="col"
                className={
                  col.headerClassName ??
                  `px-4 py-3 text-left text-xs font-semibold text-foreground tracking-wide ${idx === 0 ? "pl-6" : ""} ${
                    col.sortable
                      ? "cursor-pointer hover:bg-muted/50 select-none"
                      : ""
                  }`
                }
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-2">
                  <span>{col.header}</span>
                  {col.sortable && (
                    <span className="inline-flex">
                      {sortConfig?.key === col.key ? (
                        sortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="w-4 h-4 text-foreground" />
                        ) : (
                          <ArrowDownIcon className="w-4 h-4 text-foreground" />
                        )
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
            {actions && actions.length > 0 && (
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-semibold text-foreground tracking-wide pr-6 w-12"
              >
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paginatedData.length === 0 ? (
            <tr>
              <td
                colSpan={totalColumns}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            paginatedData.map((row, rowIndex) => {
              const rowKey = keyExtractor(row);
              const isSelected = selectedRows.has(rowKey);

              return (
                <tr
                  key={rowKey}
                  className={`border-border transition-colors ${
                    isSelected
                      ? "bg-accent/20 hover:bg-accent/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {numbering && (
                    <td className="px-4 py-3.5 text-sm text-muted-foreground font-medium">
                      {startIndex + rowIndex + 1}
                    </td>
                  )}
                  {selectable && (
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(rowKey)}
                        className="w-4 h-4 rounded border-border"
                        aria-label={`Select row ${rowIndex + 1}`}
                      />
                    </td>
                  )}
                  {visibleColumns.map((col, colIndex) => (
                    <td
                      key={col.key}
                      className={
                        col.cellClassName ??
                        `px-4 py-3.5 text-sm text-foreground ${colIndex === 0 ? "pl-6 font-medium" : ""}`
                      }
                    >
                      {col.render(row, rowIndex)}
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td className="px-4 py-3.5 text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                            aria-label="Open actions menu"
                          >
                            <EllipsisVerticalIcon className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {actions.map((action, actionIndex) => {
                            const isDisabled =
                              typeof action.disabled === "function"
                                ? action.disabled(row)
                                : action.disabled;
                            const label =
                              typeof action.label === "function"
                                ? action.label(row)
                                : action.label;
                            const icon =
                              typeof action.icon === "function"
                                ? action.icon(row)
                                : action.icon;

                            return (
                              <DropdownMenuItem
                                key={actionIndex}
                                onClick={() => action.onClick(row)}
                                disabled={isDisabled}
                                className={action.className}
                              >
                                {icon && (
                                  <span className="mr-2 inline-flex">
                                    {icon}
                                  </span>
                                )}
                                {label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {filteredData.length > 0 && filteredData.length > 10 && (
        <div className="flex items-center justify-center px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-foreground text-background"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
