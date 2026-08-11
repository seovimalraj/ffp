"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import {
  KIND_COLORS,
  KIND_LABELS,
  type EntityKind,
  type SelectableEntity,
} from "../lib/selectable";

/**
 * The Features panel: every selectable entity, grouped by kind.
 *
 * Selection is owned by the page and passed in, so this panel and the 3D
 * overlay are always showing the same thing - picking in the viewer scrolls the
 * matching row into view here, and clicking a row highlights it there.
 */

interface EntityPanelProps {
  entities: SelectableEntity[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  topologyAvailable: boolean;
  onRequestTopology: () => void;
  loadingTopology: boolean;
}

const KIND_ORDER: EntityKind[] = ["feature", "face", "edge", "vertex"];

export function EntityPanel({
  entities,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  topologyAvailable,
  onRequestTopology,
  loadingTopology,
}: EntityPanelProps) {
  const [query, setQuery] = useState("");
  const [activeKinds, setActiveKinds] = useState<Set<EntityKind>>(
    () => new Set<EntityKind>(["feature"]),
  );
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const counts = useMemo(() => {
    const map = new Map<EntityKind, number>();
    for (const entity of entities) {
      map.set(entity.kind, (map.get(entity.kind) ?? 0) + 1);
    }
    return map;
  }, [entities]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entities.filter((entity) => {
      if (!activeKinds.has(entity.kind)) return false;
      if (!needle) return true;
      return (
        entity.label.toLowerCase().includes(needle) ||
        entity.detail.toLowerCase().includes(needle)
      );
    });
  }, [entities, activeKinds, query]);

  const grouped = useMemo(() => {
    const map = new Map<EntityKind, SelectableEntity[]>();
    for (const entity of visible) {
      const list = map.get(entity.kind) ?? [];
      list.push(entity);
      map.set(entity.kind, list);
    }
    return map;
  }, [visible]);

  // Selecting in the 3D view must reveal the row here, including when the row
  // sits inside a group the user has collapsed.
  useEffect(() => {
    if (!selectedId) return;
    const entity = entities.find((item) => item.id === selectedId);
    if (entity && !activeKinds.has(entity.kind)) {
      setActiveKinds((previous) => new Set(previous).add(entity.kind));
      return;
    }
    rowRefs.current
      .get(selectedId)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, entities, activeKinds]);

  const toggleKind = (kind: EntityKind) => {
    setActiveKinds((previous) => {
      const next = new Set(previous);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const selected = entities.find((entity) => entity.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-slate-200 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter entities…"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-blue-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {KIND_ORDER.map((kind) => {
            const count = counts.get(kind) ?? 0;
            const active = activeKinds.has(kind);
            const disabled = count === 0;
            return (
              <button
                key={kind}
                onClick={() => !disabled && toggleKind(kind)}
                disabled={disabled}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  disabled
                    ? "cursor-not-allowed bg-slate-50 text-slate-300"
                    : active
                      ? "text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                style={active && !disabled ? { backgroundColor: KIND_COLORS[kind] } : undefined}
              >
                {KIND_LABELS[kind]} {count > 0 && <span className="opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {!topologyAvailable && (
          <button
            onClick={onRequestTopology}
            disabled={loadingTopology}
            className="w-full rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-700 disabled:opacity-60"
          >
            {loadingTopology
              ? "Loading faces, edges and vertices…"
              : "Load faces, edges and vertices"}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-xs leading-relaxed text-slate-500">
            {entities.length === 0
              ? "No selectable geometry in this model."
              : "Nothing matches the current filter."}
          </p>
        ) : (
          KIND_ORDER.filter((kind) => grouped.has(kind)).map((kind) => (
            <div key={kind}>
              <h4 className="sticky top-0 z-10 bg-slate-50/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                {KIND_LABELS[kind]}
                <span className="ml-1.5 font-normal text-slate-400">
                  {grouped.get(kind)!.length}
                </span>
              </h4>
              <ul>
                {grouped.get(kind)!.map((entity) => {
                  const isSelected = entity.id === selectedId;
                  const isHovered = entity.id === hoveredId;
                  return (
                    <li
                      key={entity.id}
                      ref={(node) => {
                        if (node) rowRefs.current.set(entity.id, node);
                        else rowRefs.current.delete(entity.id);
                      }}
                    >
                      <button
                        onClick={() => onSelect(isSelected ? null : entity.id)}
                        onMouseEnter={() => onHover(entity.id)}
                        onMouseLeave={() => onHover(null)}
                        aria-pressed={isSelected}
                        className={`flex w-full items-start gap-2 border-l-2 px-3 py-1.5 text-left transition-colors ${
                          isSelected
                            ? "bg-blue-50"
                            : isHovered
                              ? "bg-slate-50"
                              : "border-transparent hover:bg-slate-50"
                        }`}
                        style={{
                          borderLeftColor: isSelected ? KIND_COLORS[entity.kind] : undefined,
                        }}
                      >
                        <ChevronRight
                          className={`mt-0.5 h-3 w-3 shrink-0 text-slate-300 transition-transform ${
                            isSelected ? "rotate-90 text-slate-500" : ""
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-800">
                              {entity.label}
                            </span>
                            {entity.ambiguous && (
                              <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-medium text-amber-800">
                                ambiguous
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {entity.detail}
                          </span>
                        </span>
                      </button>

                      {isSelected && (
                        <div className="border-l-2 bg-blue-50/50 px-3 pb-2.5 pl-8"
                          style={{ borderLeftColor: KIND_COLORS[entity.kind] }}
                        >
                          {entity.reason && (
                            <p className="mb-1.5 rounded bg-amber-50 p-1.5 text-[10px] leading-relaxed text-amber-900">
                              {entity.reason}
                            </p>
                          )}
                          <dl className="space-y-0.5">
                            {entity.properties.map(([label, value]) => (
                              <div
                                key={label}
                                className="flex items-baseline justify-between gap-2 text-[11px]"
                              >
                                <dt className="shrink-0 text-slate-500">{label}</dt>
                                <dd className="min-w-0 truncate text-right font-medium text-slate-800">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div className="shrink-0 border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
          Selected{" "}
          <span className="font-mono font-semibold text-slate-800">{selected.label}</span>{" "}
          — outlined in the viewer
        </div>
      )}
    </div>
  );
}
