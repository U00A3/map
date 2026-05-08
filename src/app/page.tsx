"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import MapPageHeader from "@/components/MapPageHeader";
import MapCapabilitiesSection from "@/components/MapCapabilitiesSection";
import DashboardCtaLink from "@/components/DashboardCtaLink";
import FooterDiscordSupport from "@/components/FooterDiscordSupport";
import NodeListSidebar, { type NodeListFilter } from "@/components/NodeListSidebar";
import RegionsDropdown from "@/components/RegionsDropdown";
import {
  apiNodesToMapPoints,
  providerLabelForPoint,
  registryHostsToMapPoints,
  type ApiNodeRow,
  type MapNodePoint,
  type RegistryGeoEntry,
} from "@/lib/nodeMapGeo";
import type { NodesWorldMapHandle } from "@/components/NodesWorldMap";

const NodesWorldMap = dynamic(() => import("@/components/NodesWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[min(70vh,560px)] w-full min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 animate-pulse" />
  ),
});

const MAIN = (process.env.NEXT_PUBLIC_MAIN_APP_URL || "").replace(/\/+$/, "");

export default function HomePage() {
  const mapRef = useRef<NodesWorldMapHandle>(null);
  const [dashboardPoints, setDashboardPoints] = useState<MapNodePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listFilter, setListFilter] = useState<NodeListFilter>("all");
  const [selected, setSelected] = useState<MapNodePoint | null>(null);
  const [registryGeo, setRegistryGeo] = useState<Record<string, RegistryGeoEntry>>({});
  const [udpRegistryHosts, setUdpRegistryHosts] = useState<{ host: string; status: string }[]>([]);
  const [udpRegistryLoading, setUdpRegistryLoading] = useState(true);
  const [udpRegistryError, setUdpRegistryError] = useState<string | null>(null);
  const [governorHosts, setGovernorHosts] = useState<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const fetchNodes = useCallback(async (govSet?: Set<string>) => {
    try {
      const res = await fetch("/api/nodes/", { cache: "no-store" });
      const j = (await res.json()) as { nodes?: ApiNodeRow[]; error?: string };
      if (!res.ok) {
        throw new Error(j.error || "Failed to load nodes");
      }
      setDashboardPoints(apiNodesToMapPoints(j.nodes ?? [], govSet));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load error");
      setDashboardPoints((prev) => (prev.length > 0 ? prev : []));
    } finally {
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  const fetchGovernors = useCallback(async () => {
    try {
      const res = await fetch("/api/governors/", { cache: "no-store" });
      const j = (await res.json()) as { governors?: { hostname: string }[] };
      if (!res.ok || !j.governors) return new Set<string>();
      const s = new Set(j.governors.map((g) => g.hostname.trim().toLowerCase()));
      setGovernorHosts(s);
      return s;
    } catch {
      return new Set<string>();
    }
  }, []);

  useEffect(() => {
    void fetchGovernors().then((govSet) => fetchNodes(govSet));
  }, [fetchGovernors, fetchNodes]);

  useEffect(() => {
    const id = window.setInterval(() => void fetchNodes(governorHosts), 30_000);
    return () => window.clearInterval(id);
  }, [fetchNodes, governorHosts]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/udp-hosts/", { cache: "no-store" });
        const j = (await res.json()) as { hosts?: { host: string; status: string }[]; error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(j.error || "Failed to load DNS list");
        setUdpRegistryHosts(j.hosts ?? []);
        setUdpRegistryError(null);
      } catch (e) {
        if (!cancelled) {
          setUdpRegistryError(e instanceof Error ? e.message : "DNS list error");
          setUdpRegistryHosts((prev) => (prev.length > 0 ? prev : []));
        }
      } finally {
        if (!cancelled) setUdpRegistryLoading(false);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/registry-geo/", { cache: "no-store" });
        const j = (await res.json()) as { geo?: Record<string, RegistryGeoEntry> };
        if (cancelled) return;
        const incoming = j.geo ?? {};
        setRegistryGeo((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(incoming)) {
            if (v && Number.isFinite(v.lat) && Number.isFinite(v.lon)) {
              next[k] = v;
            }
          }
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const dashboardHostsLower = useMemo(
    () => new Set(dashboardPoints.map((p) => p.host.toLowerCase())),
    [dashboardPoints],
  );

  const registryPoints = useMemo(
    () => registryHostsToMapPoints(udpRegistryHosts, dashboardHostsLower, registryGeo, governorHosts),
    [udpRegistryHosts, dashboardHostsLower, registryGeo, governorHosts],
  );

  const allCombinedPoints = useMemo(
    () => [...dashboardPoints, ...registryPoints],
    [dashboardPoints, registryPoints],
  );

  const mapPoints = useMemo(() => {
    switch (listFilter) {
      case "monitored":
        return allCombinedPoints.filter((p) => p.source === "dashboard");
      case "governors":
        return allCombinedPoints.filter((p) => p.isGovernor);
      default:
        return allCombinedPoints;
    }
  }, [allCombinedPoints, listFilter]);

  useEffect(() => {
    if (selected && !mapPoints.some((p) => p.id === selected.id)) {
      setSelected(null);
    }
  }, [mapPoints, selected]);

  const handleSelectFromMap = useCallback((p: MapNodePoint) => {
    setSelected(p);
  }, []);

  const handlePopupClosedForNodeId = useCallback((id: string) => {
    setSelected((current) => (current?.id === id ? null : current));
  }, []);

  const handleListItemClick = useCallback((p: MapNodePoint) => {
    setSelected(p);
  }, []);

  const regions = new Set(allCombinedPoints.map((p) => p.country).filter(Boolean)).size;
  const regionBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allCombinedPoints) {
      if (!p.country) continue;
      counts.set(p.country, (counts.get(p.country) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, count]) => ({ code, count }));
  }, [allCombinedPoints]);

  const providerBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allCombinedPoints) {
      const label = providerLabelForPoint(p);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, count]) => ({ code, count }));
  }, [allCombinedPoints]);

  const providerDistinct = providerBreakdown.length;

  const dashHref = MAIN ? `${MAIN}/` : "/";

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <MapPageHeader rightSlot={<DashboardCtaLink href={dashHref} />} />

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-6 pb-16 lg:px-10">
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="pb-6 pt-12"
        >
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <h1 className="text-3xl font-bold leading-[1.15] tracking-tight md:text-4xl">
                Node Map
                <span className="beta-badge relative -top-1 ml-2.5 inline-block select-none rounded-md px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.15em]">
                  Beta
                </span>
                <span className="mt-1.5 block text-base font-medium leading-snug tracking-normal text-[var(--text-secondary)] md:text-lg">
                  Current network snapshot
                </span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                Node Map is an interactive view of the full Redbelly node network on a light, fluid 2D map. You see
                active nodes from the dashboard and the full list of hosts discovered in DNS, including those not yet
                added to the dashboard.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                The map refreshes automatically every 30 seconds so you always see the current network state.
              </p>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-3 lg:max-w-[min(100%,22rem)] lg:self-stretch lg:items-end lg:justify-end">
              <div className="flex flex-wrap justify-end">
                <RegionsDropdown
                  regionCount={regions}
                  providerCount={providerDistinct}
                  regions={regionBreakdown}
                  providers={providerBreakdown}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <p className="mb-4 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">Loading…</p>
          ) : error ? (
            <p className="mb-4 text-sm text-red-400/90">Error: {error}</p>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <NodeListSidebar
              allPoints={allCombinedPoints}
              filter={listFilter}
              onFilterChange={setListFilter}
              selected={selected}
              onItemClick={handleListItemClick}
            />

            <div className="relative min-h-[min(70vh,560px)] min-w-0 flex-1">
              <div
                className="pointer-events-none absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)]/95 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-sm"
                aria-hidden
              >
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--section-icon-cyan-fg)]" />
                Live · 30s
              </div>
              <NodesWorldMap
                ref={mapRef}
                points={mapPoints}
                selectedId={selected?.id ?? null}
                onSelectPoint={handleSelectFromMap}
                onPopupClosedForNodeId={handlePopupClosedForNodeId}
              />
            </div>
          </div>

          <MapCapabilitiesSection />
        </motion.section>
      </main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 border-t border-[var(--border-subtle)] px-6 py-6 lg:px-10"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-y-4 text-[11px] uppercase tracking-widest text-[var(--text-muted)] sm:grid-cols-3 sm:items-center">
          <div className="flex justify-center sm:justify-start">
            <span className="normal-case tracking-normal">Powered by 1F592</span>
          </div>
          <div className="flex justify-center">
            <span
              className="group footer-github-chip relative inline-flex cursor-default items-center gap-2 overflow-hidden rounded-lg border border-[var(--border-subtle)] px-3 py-2 normal-case tracking-normal transition-all duration-300"
              title="Still in private view"
            >
              <span
                className="footer-github-chip__glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <svg
                className="relative z-[1] h-3.5 w-3.5 shrink-0 opacity-90 transition-transform duration-300 group-hover:scale-110"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                />
              </svg>
              <span className="relative z-[1]">Bellydash on GitHub</span>
            </span>
          </div>
          <div className="flex justify-center sm:justify-end">
            <FooterDiscordSupport />
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

