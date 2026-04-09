"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapNodePoint } from "@/lib/nodeMapGeo";

export type NodeListFilter = "all" | "monitored" | "governors";

type Props = {
  className?: string;
  allPoints: MapNodePoint[];
  filter: NodeListFilter;
  onFilterChange: (f: NodeListFilter) => void;
  selected: MapNodePoint | null;
  onItemClick: (p: MapNodePoint) => void;
};

export default function NodeListSidebar({
  className = "",
  allPoints,
  filter,
  onFilterChange,
  selected,
  onItemClick,
}: Props) {
  const [q, setQ] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const counts = useMemo(
    () => ({
      all: allPoints.length,
      monitored: allPoints.filter((p) => p.source === "dashboard").length,
      governors: allPoints.filter((p) => p.isGovernor).length,
    }),
    [allPoints],
  );

  const filtered = useMemo(() => {
    let pts = allPoints;
    switch (filter) {
      case "monitored":
        pts = pts.filter((p) => p.source === "dashboard");
        break;
      case "governors":
        pts = pts.filter((p) => p.isGovernor);
        break;
    }
    const s = q.trim().toLowerCase();
    if (s) pts = pts.filter((p) => p.host.toLowerCase().includes(s));
    return pts;
  }, [allPoints, filter, q]);

  useEffect(() => {
    if (!selected) return;
    const el = itemRefs.current.get(selected.id);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const categoryCount = counts[filter];
  const showRatio = q.trim() !== "" && filtered.length !== categoryCount;

  return (
    <aside
      className={`flex max-h-[min(52vh,420px)] w-full flex-col gap-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 backdrop-blur-sm lg:max-h-[min(70vh,560px)] lg:w-[min(100%,280px)] lg:shrink-0 ${className}`}
    >
      <div className="border-b border-[var(--border-subtle)] px-3 pb-2.5 pt-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search domain..."
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/50 px-3 py-2 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-medium)] focus:outline-none focus:ring-1 focus:ring-[var(--section-icon-cyan-fg)]/30"
          aria-label="Search domain list"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[var(--border-subtle)] px-3 py-2.5">
        <Chip active={filter === "all"} onClick={() => onFilterChange("all")} label="All" count={counts.all} />
        <Chip active={filter === "monitored"} onClick={() => onFilterChange("monitored")} label="Monitored" count={counts.monitored} dot="bg-emerald-400" />
        <Chip active={filter === "governors"} onClick={() => onFilterChange("governors")} label="Governors" count={counts.governors} dot="bg-amber-400" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="shrink-0 px-4 pb-2 pt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Domains{" "}
          <span className="text-[var(--section-icon-cyan-fg)]">
            ({showRatio ? `${filtered.length} / ${categoryCount}` : filtered.length})
          </span>
        </p>
        <div
          ref={scrollRef}
          className="node-map-list-scroll min-h-0 flex-1 overflow-y-scroll overscroll-y-contain px-2 pb-4"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-[var(--text-muted)]">No matches.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(p.id, el);
                  else itemRefs.current.delete(p.id);
                }}
                type="button"
                onClick={() => onItemClick(p)}
                className={`node-map-row mb-1 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition-colors ${
                  selected?.id === p.id
                    ? "border-[var(--section-icon-cyan-fg)]/40 bg-[var(--section-icon-cyan-bg)]"
                    : "border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]"
                }`}
              >
                <span
                  className={`relative h-2.5 w-2.5 shrink-0 ${
                    p.isGovernor
                      ? "rotate-45 rounded-[1.5px] border-[1.5px] border-amber-400/80"
                      : "rounded-full"
                  } ${
                    p.status === "online"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                      : p.status === "offline"
                        ? "bg-red-400"
                        : p.source === "registry"
                          ? "bg-neutral-500"
                          : "bg-neutral-400"
                  }`}
                  title={p.isGovernor ? "Governor" : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="mono truncate text-[11px] font-semibold text-[var(--text-primary)]">
                    {p.host}
                  </div>
                  <div className="truncate text-[10px] text-[var(--text-muted)]">
                    {nodeSubtitle(p)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function nodeSubtitle(p: MapNodePoint): string {
  const parts: string[] = [];
  if (p.isGovernor) parts.push("Governor");
  if (p.source === "dashboard") {
    if (p.status === "online") parts.push("Online");
    else if (p.status === "offline") parts.push("Offline");
    else parts.push("Monitored");
  } else {
    parts.push("Not monitored");
  }
  if (p.country) parts.push(p.country);
  return parts.join(" \u00b7 ");
}

function Chip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
        active
          ? "border-[var(--section-icon-cyan-fg)]/45 bg-[var(--section-icon-cyan-bg)] text-[var(--text-primary)]"
          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-card-hover)]"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />}
      <span>{label}</span>
      <span className="mono text-[9px] text-[var(--text-muted)]">{count}</span>
    </button>
  );
}
