"use client";

import type { ReactNode } from "react";
import { useState } from "react";
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
import { LayoutGrid, List, Search } from "lucide-react";

export type ViewMode = "table" | "cards";

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

export type CardConfig<T> = {
  title: (row: T) => ReactNode;
  subtitle?: (row: T) => ReactNode;
  badge?: (row: T) => { label: string; color: string } | null;
  stats?: Array<{
    label: string;
    value: (row: T) => ReactNode;
    icon?: ReactNode;
  }>;
  progress?: {
    current: (row: T) => number;
    total: (row: T) => number;
    label?: string;
  };
  footer?: (row: T) => ReactNode;
  icon?: (row: T) => ReactNode;
  accentColor?: (row: T) => string;
};

type DataViewProps<T> = {
  columns: Column<T>[];
  data: T[];
  actions?: Action<T>[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingMessage?: string;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  numbering?: boolean;
  cardConfig?: CardConfig<T>;
  defaultView?: ViewMode;
  showViewToggle?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
};

// Progress Bar Component
const ProgressBar = ({
  current,
  total,
  showLabel = true,
}: {
  current: number;
  total: number;
  showLabel?: boolean;
}) => {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const getColor = () => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-amber-500";
    if (percentage >= 50) return "bg-blue-500";
    return "bg-emerald-500";
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">
            {current.toLocaleString()} / {total.toLocaleString()}
          </span>
          <span
            className={`font-semibold ${
              percentage >= 90
                ? "text-red-600"
                : percentage >= 70
                  ? "text-amber-600"
                  : "text-emerald-600"
            }`}
          >
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-700 ease-out rounded-full relative`}
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>
  );
};

// Card Component
function DataCard<T>({
  row,
  config,
  actions,
}: {
  row: T;
  config: CardConfig<T>;
  actions?: Action<T>[];
}) {
  const badge = config.badge?.(row);
  const accentColor = config.accentColor?.(row) || "bg-primary";

  return (
    <div className="group relative bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300">
      {/* Accent top bar */}
      <div className={`h-1 ${accentColor}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {config.icon && (
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-muted">
                {config.icon(row)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {config.title(row)}
              </h3>
              {config.subtitle && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {config.subtitle(row)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {badge && (
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${badge.color}`}
              >
                {badge.label}
              </span>
            )}
            {actions && actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {actions.map((action, idx) => {
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
                        key={idx}
                        onClick={() => action.onClick(row)}
                        disabled={isDisabled}
                        className={action.className}
                      >
                        {icon && <span className="mr-2">{icon}</span>}
                        {label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {config.stats && config.stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {config.stats.map((stat, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50"
              >
                {stat.icon && (
                  <span className="text-muted-foreground">{stat.icon}</span>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {stat.value(row)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        {config.progress && (
          <div className="mt-4">
            {config.progress.label && (
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {config.progress.label}
              </p>
            )}
            <ProgressBar
              current={config.progress.current(row)}
              total={config.progress.total(row)}
            />
          </div>
        )}

        {/* Footer */}
        {config.footer && (
          <div className="mt-4 pt-4 border-t border-border">
            {config.footer(row)}
          </div>
        )}
      </div>
    </div>
  );
}

// Main DataView Component
export function DataView<T>({
  columns,
  data,
  actions,
  keyExtractor,
  emptyMessage = "No data found.",
  isLoading = false,
  loadingMessage = "Loading...",
  pageSize = 10,
  selectable = false,
  onSelectionChange,
  numbering = false,
  cardConfig,
  defaultView = "table",
  showViewToggle = true,
  searchable = false,
  searchPlaceholder = "Search...",
  searchKeys = [],
}: DataViewProps<T>) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set(),
  );

  const visibleColumns = columns.filter((col) => !col.hidden);

  // Search filter
  const searchedData = searchQuery
    ? data.filter((row) => {
        if (searchKeys.length === 0) return true;
        return searchKeys.some((key) => {
          const value = row[key];
          return String(value)
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        });
      })
    : data;

  // Sort
  const sortedData = [...searchedData].sort((a, b) => {
    if (!sortConfig) return 0;
    const column = columns.find((col) => col.key === sortConfig.key);
    if (!column?.sortable) return 0;

    const aValue = (a as Record<string, unknown>)[column.key];
    const bValue = (b as Record<string, unknown>)[column.key];

    let result = 0;
    if (typeof aValue === "string" && typeof bValue === "string") {
      result = aValue.localeCompare(bValue);
    } else if (typeof aValue === "number" && typeof bValue === "number") {
      result = aValue - bValue;
    } else {
      result = String(aValue).localeCompare(String(bValue));
    }
    return sortConfig.direction === "asc" ? result : -result;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const handleSelectRow = (rowKey: string | number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowKey)) {
      newSelected.delete(rowKey);
    } else {
      newSelected.add(rowKey);
    }
    setSelectedRows(newSelected);
    onSelectionChange?.(
      data.filter((row) => newSelected.has(keyExtractor(row))),
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set<string | number>();
      paginatedData.forEach((row) => newSelected.add(keyExtractor(row)));
      setSelectedRows(newSelected);
      onSelectionChange?.(
        data.filter((row) => newSelected.has(keyExtractor(row))),
      );
    }
  };

  // const totalColumns =
  //   visibleColumns.length +
  //   (actions?.length ? 1 : 0) +
  //   (selectable ? 1 : 0) +
  //   (numbering ? 1 : 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-muted rounded-full" />
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {loadingMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {searchable && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        )}

        {showViewToggle && cardConfig && (
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "cards"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {paginatedData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : viewMode === "cards" && cardConfig ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedData.map((row) => (
            <DataCard
              key={keyExtractor(row)}
              row={row}
              config={cardConfig}
              actions={actions}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                {numbering && (
                  <th className="px-4 py-3 w-12 text-left text-xs font-semibold text-foreground">
                    #
                  </th>
                )}
                {selectable && (
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedRows.size === paginatedData.length &&
                        paginatedData.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-border"
                    />
                  </th>
                )}
                {visibleColumns.map((col, idx) => (
                  <th
                    key={col.key}
                    className={
                      col.headerClassName ??
                      `px-4 py-3 text-left text-xs font-semibold text-foreground ${
                        idx === 0 ? "pl-6" : ""
                      } ${col.sortable ? "cursor-pointer hover:bg-muted/50" : ""}`
                    }
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{col.header}</span>
                      {col.sortable &&
                        sortConfig?.key === col.key &&
                        (sortConfig.direction === "asc" ? (
                          <ArrowUpIcon className="w-4 h-4" />
                        ) : (
                          <ArrowDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                ))}
                {actions && actions.length > 0 && (
                  <th className="px-4 py-3 w-12">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedData.map((row, rowIndex) => {
                const rowKey = keyExtractor(row);
                const isSelected = selectedRows.has(rowKey);
                return (
                  <tr
                    key={rowKey}
                    className={`transition-colors ${
                      isSelected
                        ? "bg-accent/20 hover:bg-accent/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {numbering && (
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">
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
                        />
                      </td>
                    )}
                    {visibleColumns.map((col, colIndex) => (
                      <td
                        key={col.key}
                        className={
                          col.cellClassName ??
                          `px-4 py-3.5 text-sm text-foreground ${
                            colIndex === 0 ? "pl-6 font-medium" : ""
                          }`
                        }
                      >
                        {col.render(row, rowIndex)}
                      </td>
                    ))}
                    {actions && actions.length > 0 && (
                      <td className="px-4 py-3.5 text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                              <EllipsisVerticalIcon className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {actions.map((action, idx) => {
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
                                  key={idx}
                                  onClick={() => action.onClick(row)}
                                  disabled={isDisabled}
                                  className={action.className}
                                >
                                  {icon && <span className="mr-2">{icon}</span>}
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
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {sortedData.length > pageSize && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-
            {Math.min(startIndex + pageSize, sortedData.length)} of{" "}
            {sortedData.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
