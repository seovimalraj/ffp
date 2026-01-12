"use client";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/20/solid";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils"; // Assuming utils exists, or I will use standard class strings
import { useRef, useCallback } from "react";

export type Column<T> = {
  key: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  hidden?: boolean;
  sticky?: "left" | "right";
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
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  numbering?: boolean;
  onEndReached?: () => void; // Function to call when end is reached
  hasMore?: boolean; // Whether there is more data to load from server
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
  pageSize = 20,
  selectable = false,
  onSelectionChange,
  numbering = false,
  onEndReached,
  hasMore = false,
}: DataTableProps<T>) {
  const visibleColumns = columns.filter((col) => !col.hidden);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [searchQuery, _setSearchQuery] = useState("");
  // Replaced currentPage with visibleCount for infinite scroll
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set(),
  );

  const observerTarget = useRef(null);

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
    setVisibleCount(pageSize); // Reset visible count on filter change
  }, [filteredData, onFilterChange, pageSize]);

  // Infinite Scroll Logic
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting) {
        if (visibleCount < filteredData.length) {
          setVisibleCount((prev) =>
            Math.min(prev + pageSize, filteredData.length),
          );
        } else if (onEndReached) {
          onEndReached();
        }
      }
    },
    [visibleCount, filteredData.length, pageSize, onEndReached],
  );

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0,
    });

    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  // Data to render: slice of filteredData based on visibleCount
  const processedData = filteredData.slice(0, visibleCount);

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
    // Select all FILTERED data, not just visible
    if (selectedRows.size === filteredData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set(selectedRows);
      filteredData.forEach((row) => {
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

  if (isLoading && data.length === 0) {
    // Only show full loader if initial load
    return (
      <div className="flex items-center justify-center py-24 min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">
            {loadingMessage}
          </p>
        </div>
      </div>
    );
  }

  // Calculate offsets for left-sticky columns
  let currentLeftOffset = 0;
  if (numbering) currentLeftOffset += 48; // Estimate width for numbering
  if (selectable) currentLeftOffset += 52; // Estimate width for selectable

  return (
    <div className="relative w-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm text-left border-separate border-spacing-0">
          <thead className="text-muted-foreground font-medium sticky top-0 z-30">
            <tr className="">
              {numbering && (
                <th
                  scope="col"
                  className="px-6 py-4 w-12 text-xs font-semibold uppercase tracking-wider sticky left-0 z-40 bg-muted border-b border-border"
                >
                  #
                </th>
              )}
              {selectable && (
                <th
                  scope="col"
                  className={cn(
                    "px-6 py-4 w-12 sticky z-40 bg-muted border-b border-border",
                    numbering ? "left-12" : "left-0",
                  )}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedRows.size === filteredData.length &&
                        filteredData.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer transition-all"
                      aria-label="Select all rows"
                    />
                  </div>
                </th>
              )}
              {visibleColumns.map((col, idx) => {
                const isSticky = col.sticky === "left";
                const leftPos = isSticky ? currentLeftOffset : undefined;
                if (isSticky) currentLeftOffset += 200; // Assume a default width for sticky data columns

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-6 py-4 text-xs font-semibold uppercase tracking-wider border-b border-border bg-muted",
                      idx === 0 && !selectable && !numbering && "pl-8",
                      col.sortable &&
                        "cursor-pointer select-none hover:text-foreground transition-colors group",
                      col.headerClassName,
                      isSticky &&
                        "sticky z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]",
                    )}
                    style={isSticky ? { left: leftPos } : {}}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="inline-flex opacity-0 group-hover:opacity-100 transition-opacity">
                          {sortConfig?.key === col.key ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUpIcon className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownIcon className="w-3.5 h-3.5" />
                            )
                          ) : (
                            <ArrowUpIcon className="w-3.5 h-3.5 text-muted-foreground/50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              {actions && actions.length > 0 && (
                <th
                  scope="col"
                  className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider w-12 sticky right-0 z-40 bg-muted border-b border-border"
                >
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColumns}
                  className="py-16 text-center text-muted-foreground bg-card"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              processedData.map((row, rowIndex) => {
                const rowKey = keyExtractor(row);
                const isSelected = selectedRows.has(rowKey);

                // Reset offset for cells
                let cellLeftOffset = 0;
                if (numbering) cellLeftOffset += 48;
                if (selectable) cellLeftOffset += 52;

                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      "group transition-colors duration-200",
                      isSelected
                        ? "bg-primary/5 shadow-[inset_0_0_0_999px_rgba(var(--primary-rgb),0.05)]"
                        : "bg-card",
                    )}
                  >
                    {numbering && (
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs sticky left-0 z-10 bg-white dark:bg-neutral-950 group-hover:bg-slate-50 dark:group-hover:bg-neutral-900 group-[.is-selected]:bg-slate-50 dark:group-[.is-selected]:bg-neutral-900 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.1)]">
                        {rowIndex + 1}
                      </td>
                    )}
                    {selectable && (
                      <td
                        className={cn(
                          "px-6 py-4 sticky z-10 bg-white dark:bg-neutral-950 group-hover:bg-slate-50 dark:group-hover:bg-neutral-900 group-[.is-selected]:bg-slate-50 dark:group-[.is-selected]:bg-neutral-900 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.1)]",
                          numbering ? "left-12" : "left-0",
                        )}
                      >
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(rowKey)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer transition-all"
                            aria-label={`Select row ${rowIndex + 1}`}
                          />
                        </div>
                      </td>
                    )}
                    {visibleColumns.map((col, colIndex) => {
                      const isSticky = col.sticky === "left";
                      const leftPos = isSticky ? cellLeftOffset : undefined;
                      if (isSticky) cellLeftOffset += 200;

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "px-6 py-4 whitespace-nowrap bg-card group-hover:bg-muted/30 group-[.is-selected]:bg-primary/5",
                            colIndex === 0 && !selectable && !numbering
                              ? "pl-8 font-medium text-foreground"
                              : "text-muted-foreground",
                            col.cellClassName,
                            isSticky &&
                              "sticky z-10 bg-white dark:bg-neutral-950 group-hover:bg-slate-50 dark:group-hover:bg-neutral-900 group-[.is-selected]:bg-slate-50 dark:group-[.is-selected]:bg-neutral-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.1)]",
                          )}
                          style={isSticky ? { left: leftPos } : {}}
                        >
                          {col.render(row, rowIndex)}
                        </td>
                      );
                    })}
                    {actions && actions.length > 0 && (
                      <td className="px-6 py-4 text-right sticky right-0 z-10 bg-white dark:bg-neutral-950 group-hover:bg-slate-50 dark:group-hover:bg-neutral-900 group-[.is-selected]:bg-slate-50 dark:group-[.is-selected]:bg-neutral-900 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all focus:outline-none focus:ring-2 focus:ring-ring ring-offset-1"
                              aria-label="Open actions menu"
                            >
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 shadow-lg border-border rounded-xl"
                          >
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
                                  className={cn(
                                    "gap-2 cursor-pointer",
                                    action.className,
                                  )}
                                >
                                  {icon && (
                                    <span className="w-4 h-4">{icon}</span>
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

            {/* Loading more indicator or end of list spacer */}
            {(hasMore || visibleCount < filteredData.length) && (
              <tr ref={observerTarget}>
                <td colSpan={totalColumns} className="py-6 text-center bg-card">
                  {(isLoading || visibleCount < filteredData.length) && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-primary/50 border-t-transparent rounded-full animate-spin" />
                      <span>Loading more...</span>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
