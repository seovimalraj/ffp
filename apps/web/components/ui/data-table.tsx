"use client";
import type { ReactNode } from "react";
import { useState, useEffect, Fragment } from "react";
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
import { useRef, useCallback, useMemo } from "react";
import { ChevronRightIcon } from "@heroicons/react/20/solid";

export type Column<T> = {
  key: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (
    row: T,
    index: number,
    meta?: { isExpanded: boolean; toggleExpansion: () => void },
  ) => ReactNode;
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
  selectedIds?: Set<string | number>;
  renderExpansion?: (row: T) => ReactNode;
  isRowExpandable?: (row: T) => boolean;
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
  selectedIds: controlledSelectedIds,
  renderExpansion,
  isRowExpandable,
}: DataTableProps<T>) {
  const visibleColumns = columns.filter((col) => !col.hidden);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [searchQuery, _setSearchQuery] = useState("");
  // Replaced currentPage with visibleCount for infinite scroll
  // VisibleCount for infinite scroll
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [internalSelectedRows, setInternalSelectedRows] = useState<
    Set<string | number>
  >(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(
    new Set(),
  );

  const selectedRows =
    controlledSelectedIds !== undefined
      ? controlledSelectedIds
      : internalSelectedRows;

  const observerTarget = useRef(null);

  const sortedData = useMemo(() => {
    const result = [...data];
    if (!sortConfig) return result;

    const column = columns.find((col) => col.key === sortConfig.key);
    if (!column || !column.sortable) return result;

    result.sort((a, b) => {
      let comparison = 0;
      if (sortComparator) {
        comparison = sortComparator(a, b, column);
      } else {
        const aValue = (a as Record<string, unknown>)[column.key];
        const bValue = (b as Record<string, unknown>)[column.key];

        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });

    return result;
  }, [data, sortConfig, columns, sortComparator]);

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

  const filteredData = useMemo(() => {
    if (!searchQuery) return sortedData;

    return sortedData.filter((row) => {
      if (!searchableColumns || searchableColumns.length === 0) return true;

      return searchableColumns.some((columnKey) => {
        const value = (row as Record<string, unknown>)[columnKey];
        return String(value).toLowerCase().includes(searchQuery.toLowerCase());
      });
    });
  }, [sortedData, searchQuery, searchableColumns]);

  const prevDataRef = useRef(filteredData);

  useEffect(() => {
    onFilterChange?.(filteredData);

    // Only reset visibleCount if the data has fundamentally changed (e.g. filtered/searched)
    // If it's just an append (new length > old length and old items match), don't reset.
    const isAppend =
      filteredData.length > prevDataRef.current.length &&
      prevDataRef.current.every((item, i) => item === filteredData[i]);

    if (!isAppend) {
      setVisibleCount(pageSize);
    } else {
      // If it is an append, we want to make sure the new items are visible
      setVisibleCount(filteredData.length);
    }

    prevDataRef.current = filteredData;
  }, [filteredData, onFilterChange, pageSize]);

  // Track visibleCount in a ref to keep handleObserver stable
  const visibleCountRef = useRef(visibleCount);
  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting) {
        if (visibleCountRef.current < filteredData.length) {
          setVisibleCount((prev) =>
            Math.min(prev + pageSize, filteredData.length),
          );
        } else if (onEndReached) {
          onEndReached();
        }
      }
    },
    [filteredData.length, pageSize, onEndReached],
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

    if (controlledSelectedIds === undefined) {
      setInternalSelectedRows(newSelected);
    }

    const selectedData = data.filter((row) =>
      newSelected.has(keyExtractor(row)),
    );
    onSelectionChange?.(selectedData);
  };

  const handleSelectAll = () => {
    // Select all FILTERED data, not just visible
    if (selectedRows.size === filteredData.length && filteredData.length > 0) {
      if (controlledSelectedIds === undefined) {
        setInternalSelectedRows(new Set());
      }
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set(selectedRows);
      filteredData.forEach((row) => {
        newSelected.add(keyExtractor(row));
      });

      if (controlledSelectedIds === undefined) {
        setInternalSelectedRows(newSelected);
      }

      const selectedData = data.filter((row) =>
        newSelected.has(keyExtractor(row)),
      );
      onSelectionChange?.(selectedData);
    }
  };

  const toggleRowExpansion = (rowKey: string | number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowKey)) {
      newExpanded.delete(rowKey);
    } else {
      newExpanded.add(rowKey);
    }
    setExpandedRows(newExpanded);
  };

  const totalColumns =
    visibleColumns.length +
    (actions?.length ? 1 : 0) +
    (selectable ? 1 : 0) +
    (numbering ? 1 : 0) +
    (renderExpansion ? 1 : 0);

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
  // Updated widths: Expansion=36px, Numbering=40px, Selectable=40px
  let currentLeftOffset = 0;
  if (renderExpansion) currentLeftOffset += 36;
  if (numbering) currentLeftOffset += 40;
  if (selectable) currentLeftOffset += 44; // 40px + some breathing room

  return (
    <div className="relative w-full rounded-md border border-border bg-card overflow-hidden">
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/50 text-muted-foreground font-medium sticky top-0 z-30">
            <tr className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              {renderExpansion && (
                <th
                  scope="col"
                  className="h-10 w-9 px-2 sticky left-0 z-40 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/50 border-b border-border text-center"
                >
                  <span className="sr-only">Expand</span>
                </th>
              )}
              {numbering && (
                <th
                  scope="col"
                  className={cn(
                    "h-10 w-10 px-2 text-xs font-semibold uppercase tracking-wider sticky z-40 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/50 border-b border-border text-center",
                    renderExpansion ? "left-9" : "left-0",
                  )}
                >
                  #
                </th>
              )}
              {selectable && (
                <th
                  scope="col"
                  className={cn(
                    "h-10 w-10 px-4 sticky z-40 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/50 border-b border-border",
                    renderExpansion && numbering
                      ? "left-[76px]" // 36 + 40
                      : renderExpansion
                        ? "left-9"
                        : numbering
                          ? "left-10"
                          : "left-0",
                  )}
                >
                  <div className="flex items-center justify-center">
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
                      "h-10 px-4 text-xs font-semibold uppercase tracking-wider border-b border-border bg-muted/50 align-middle",
                      idx === 0 && !selectable && !numbering && "pl-6",
                      col.sortable &&
                        "cursor-pointer select-none hover:text-foreground transition-colors group",
                      col.headerClassName,
                      isSticky &&
                        "sticky z-40 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/50",
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
                  className="h-10 w-12 px-4 text-right text-xs font-semibold uppercase tracking-wider sticky right-0 z-40 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/50 border-b border-border"
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
                if (renderExpansion) cellLeftOffset += 36;
                if (numbering) cellLeftOffset += 40;
                if (selectable) cellLeftOffset += 44;

                return (
                  <Fragment key={rowKey}>
                    <tr
                      key={rowKey}
                      data-state={isSelected ? "selected" : undefined}
                      className={cn(
                        "group transition-colors duration-200 hover:bg-muted/40",
                        isSelected
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "bg-card",
                        expandedRows.has(rowKey) && "bg-muted/30",
                      )}
                    >
                      {renderExpansion && (
                        <td className="px-2 py-3 sticky left-0 z-10 bg-card dark:bg-card group-hover:bg-muted/40 dark:group-hover:bg-muted/40 group-data-[state=selected]:bg-muted/40 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-center align-middle">
                          <button
                            onClick={() => toggleRowExpansion(rowKey)}
                            disabled={isRowExpandable && !isRowExpandable(row)}
                            className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-muted-foreground/10 transition-all",
                              isRowExpandable &&
                                !isRowExpandable(row) &&
                                "opacity-0 pointer-events-none",
                            )}
                          >
                            <ChevronRightIcon
                              className={cn(
                                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                                expandedRows.has(rowKey) &&
                                  "rotate-90 text-primary",
                              )}
                            />
                          </button>
                        </td>
                      )}
                      {numbering && (
                        <td
                          className={cn(
                            "px-2 py-3 text-muted-foreground font-mono text-xs sticky z-10 bg-card dark:bg-card group-hover:bg-muted/40 dark:group-hover:bg-muted/40 group-data-[state=selected]:bg-muted/40 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-center align-middle",
                            renderExpansion ? "left-9" : "left-0",
                          )}
                        >
                          {rowIndex + 1}
                        </td>
                      )}
                      {selectable && (
                        <td
                          className={cn(
                            "px-4 py-3 sticky z-10 bg-card dark:bg-card group-hover:bg-muted/40 dark:group-hover:bg-muted/40 group-data-[state=selected]:bg-muted/40 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] align-middle",
                            renderExpansion && numbering
                              ? "left-[76px]"
                              : renderExpansion
                                ? "left-9"
                                : numbering
                                  ? "left-10"
                                  : "left-0",
                          )}
                        >
                          <div className="flex items-center justify-center">
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
                              "px-4 py-3 whitespace-nowrap align-middle",
                              colIndex === 0 && !selectable && !numbering
                                ? "pl-6 font-medium text-foreground"
                                : "text-muted-foreground",
                              col.cellClassName,
                              isSticky &&
                                "sticky z-10 bg-card dark:bg-card group-hover:bg-muted/40 dark:group-hover:bg-muted/40 group-data-[state=selected]:bg-muted/40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                            )}
                            style={isSticky ? { left: leftPos } : {}}
                          >
                            {col.render(row, rowIndex, {
                              isExpanded: expandedRows.has(rowKey),
                              toggleExpansion: () => toggleRowExpansion(rowKey),
                            })}
                          </td>
                        );
                      })}
                      {actions && actions.length > 0 && (
                        <td className="px-4 py-3 text-right sticky right-0 z-10 bg-card dark:bg-card group-hover:bg-muted/40 dark:group-hover:bg-muted/40 group-data-[state=selected]:bg-muted/40 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)] align-middle">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted-foreground/10 transition-all focus:outline-none focus:ring-2 focus:ring-ring ring-offset-1"
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
                    {renderExpansion &&
                      expandedRows.has(rowKey) &&
                      (!isRowExpandable || isRowExpandable(row)) && (
                        <tr className="bg-muted/5">
                          <td
                            colSpan={totalColumns}
                            className="p-0 border-b border-border"
                          >
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                              {renderExpansion(row)}
                            </div>
                          </td>
                        </tr>
                      )}
                  </Fragment>
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
export function DataTableSubRow({
  children,
  isLast,
  className,
}: {
  children: ReactNode;
  isLast?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 pl-16 relative group/subrow",
        className,
      )}
    >
      <div className="absolute left-[26px] top-0 bottom-0 pointer-events-none">
        <div
          className={cn(
            "absolute left-0 top-0 w-[1.5px] bg-gray-200 dark:bg-gray-800 group-hover/subrow:bg-blue-500/30 transition-colors duration-500",
            isLast ? "h-6" : "h-full",
          )}
        />
        <div
          className={cn(
            "absolute left-0 top-6 w-5 h-[1.5px] bg-gray-200 dark:bg-gray-800 group-hover/subrow:bg-blue-500/50 transition-colors duration-500 rounded-r-full",
          )}
        />
        {/* Connection dot */}
        <div className="absolute left-[-2px] top-[22px] w-[5.5px] h-[5.5px] rounded-full bg-gray-300 dark:bg-gray-700 group-hover/subrow:bg-blue-500 transition-colors duration-500 shadow-[0_0_0_2px_rgba(255,255,255,1)] dark:shadow-[0_0_0_2px_rgba(10,10,10,1)]" />
      </div>
      <div className="flex-1 py-3 text-sm transition-all duration-300 group-hover/subrow:translate-x-1">
        {children}
      </div>
    </div>
  );
}
