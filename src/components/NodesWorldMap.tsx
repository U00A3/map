"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { MapNodePoint, NodeMapStatus } from "@/lib/nodeMapGeo";

export type NodesWorldMapHandle = {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  invalidateSize: () => void;
  /** Fit map to all current points (same as initial bounds), or world view if empty */
  fitAllMarkers: () => void;
};

function statusStyle(
  status: NodeMapStatus,
  selected: boolean,
  source: "dashboard" | "registry" | undefined,
): {
  bg: string;
  glow: string;
  pulseClass: string;
  ring: string;
} {
  const ring = selected ? "0 0 0 2px rgba(255,255,255,0.85)" : "0 0 0 2px rgba(0,0,0,0.2)";
  if (source === "registry") {
    return {
      bg: "#737373",
      glow: "rgba(115,115,115,0.38)",
      pulseClass: "",
      ring,
    };
  }
  if (status === "online") {
    return {
      bg: "#34d399",
      glow: "rgba(52,211,153,0.45)",
      pulseClass: "nodes-map-dot--pulse",
      ring,
    };
  }
  if (status === "offline") {
    return { bg: "#f87171", glow: "rgba(248,113,113,0.4)", pulseClass: "", ring };
  }
  return { bg: "#9ca3af", glow: "rgba(156,163,175,0.35)", pulseClass: "", ring };
}

function makeMarkerIcon(p: MapNodePoint, selected: boolean): L.DivIcon {
  const src = p.source ?? "dashboard";
  const { bg, glow, pulseClass, ring } = statusStyle(p.status, selected, src);

  if (p.isGovernor) {
    const govRing = selected
      ? "0 0 0 2.5px rgba(255,255,255,0.92)"
      : "0 0 0 2px rgba(251,191,36,0.88)";
    const govPulse = p.status === "online" ? "nodes-map-gov--pulse" : "";
    return L.divIcon({
      className: "nodes-map-marker-wrap",
      html: `<div class="nodes-map-gov ${govPulse}" style="background:${bg};box-shadow:${govRing},0 0 14px rgba(251,191,36,0.55),0 0 7px ${glow},0 2px 8px rgba(0,0,0,0.4)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -13],
    });
  }

  return L.divIcon({
    className: "nodes-map-marker-wrap",
    html: `<div class="nodes-map-dot ${pulseClass}" style="background:${bg};box-shadow:${ring},0 0 10px ${glow},0 2px 8px rgba(0,0,0,0.35)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

type Props = {
  points: MapNodePoint[];
  selectedId: string | null;
  onSelectPoint: (p: MapNodePoint) => void;
  /** When the user closes the popup (×) while the node is still “selected” */
  onPopupClosedForNodeId: (id: string) => void;
  className?: string;
};

const NodesWorldMap = forwardRef<NodesWorldMapHandle, Props>(function NodesWorldMap(
  { points, selectedId, onSelectPoint, onPopupClosedForNodeId, className = "" },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const lastFitKeyRef = useRef<string>("");
  /** Avoid treating popupclose during clearLayers as user-dismiss */
  const markersMutatingRef = useRef(false);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const fitAllMarkers = useCallback(() => {
    const map = mapRef.current;
    const pts = pointsRef.current;
    if (!map) return;
    if (pts.length === 0) {
      map.setView([22, 10], 2, { animate: true, duration: 0.45 });
      return;
    }
    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lon] as L.LatLngTuple));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 5, animate: true, duration: 0.45 });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lon: number, zoom = 6) {
      mapRef.current?.flyTo([lat, lon], zoom, { animate: true, duration: 0.6 });
    },
    invalidateSize() {
      mapRef.current?.invalidateSize();
    },
    fitAllMarkers,
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      worldCopyJump: true,
      zoomControl: true,
      preferCanvas: true,
      closePopupOnClick: false,
    }).setView([22, 10], 2);

    const attrCarto =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: attrCarto,
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      /** Smaller radius at low zoom = looser clustering when zoomed out (more small clusters). */
      maxClusterRadius(zoom: number) {
        if (zoom <= 2) return 22;
        if (zoom <= 3) return 30;
        if (zoom <= 4) return 38;
        if (zoom <= 5) return 46;
        if (zoom <= 6) return 52;
        return 58;
      },
      /** From this zoom upward: single dots instead of clusters (Leaflet: higher number = more zoomed in). */
      disableClusteringAtZoom: 10,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: points.length > 200,
      iconCreateFunction(cluster) {
        const n = cluster.getChildCount();
        const hasGov = cluster.getAllChildMarkers().some((m: any) => m._isGovernor);
        const cls = hasGov ? "nodes-map-cluster nodes-map-cluster--gov" : "nodes-map-cluster";
        return L.divIcon({
          html: `<div class="${cls}"><span>${n}</span></div>`,
          className: "nodes-map-cluster-outer",
          iconSize: [40, 40],
        });
      },
    });
    map.addLayer(cluster);
    mapRef.current = map;
    clusterRef.current = cluster;

    const t = window.setTimeout(() => map.invalidateSize(), 120);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
      clusterRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    markersMutatingRef.current = true;
    cluster.clearLayers();
    markersByIdRef.current.clear();

    for (const p of points) {
      const selected = p.id === selectedId;
      const marker = L.marker([p.lat, p.lon], {
        icon: makeMarkerIcon(p, selected),
      });
      (marker as any)._isGovernor = !!p.isGovernor;
      markersByIdRef.current.set(String(p.id), marker);

      const statusLabel =
        p.status === "online" ? "online" : p.status === "offline" ? "offline" : "unknown";
      const country = p.country ?? "-";
      const latlon = `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`;
      const lat = p.latencyMs != null ? `${p.latencyMs} ms` : "-";
      const sourceRow =
        p.source === "registry"
          ? `<div class="nodes-map-popup-row"><span>Source</span><span>DNS from TSV (not on dashboard)</span></div>`
          : "";
      const roleRow = p.isGovernor
        ? `<div class="nodes-map-popup-row"><span>Role</span><span class="nodes-map-popup-governor">Governor</span></div>`
        : "";

      const hasNetGeo = Boolean(
        p.geoFromApi ||
          p.geoQuery?.trim() ||
          p.geoIsp?.trim() ||
          p.geoOrg?.trim() ||
          p.geoAs?.trim() ||
          p.geoAsname?.trim(),
      );
      const ipRow = p.geoQuery?.trim()
        ? `<div class="nodes-map-popup-row"><span>IP</span><span>${escapeHtml(p.geoQuery.trim())}</span></div>`
        : "";
      const providerText =
        p.geoIsp?.trim() || p.geoOrg?.trim() || p.geoAsname?.trim() || "—";
      const asnText = p.geoAs?.trim() || "—";
      const netGeoRows = hasNetGeo
        ? `${ipRow}<div class="nodes-map-popup-row"><span>Provider</span><span>${escapeHtml(providerText)}</span></div>
          <div class="nodes-map-popup-row"><span>ASN</span><span>${escapeHtml(asnText)}</span></div>`
        : "";

      marker.bindPopup(
        `<div class="nodes-map-popup nodes-map-popup--rich">
          <div class="nodes-map-popup-id">${escapeHtml(p.id)}</div>
          <div class="nodes-map-popup-host">${escapeHtml(p.host)}</div>
          ${roleRow}${sourceRow}
          <div class="nodes-map-popup-row"><span>Country</span><span>${escapeHtml(country)}</span></div>
          ${netGeoRows}
          <div class="nodes-map-popup-row"><span>Latency</span><span>${escapeHtml(lat)}</span></div>
          <div class="nodes-map-popup-row"><span>Status</span><span class="nodes-map-popup-status nodes-map-popup-status--${p.status}">${statusLabel}</span></div>
          <div class="nodes-map-popup-row"><span>Lat / Lon</span><span>${escapeHtml(latlon)}</span></div>
        </div>`,
        {
          maxWidth: 300,
          autoClose: false,
          closeOnClick: false,
        },
      );

      marker.on("click", () => {
        onSelectPoint(p);
      });

      marker.on("popupclose", () => {
        if (markersMutatingRef.current) return;
        onPopupClosedForNodeId(String(p.id));
      });

      cluster.addLayer(marker);
    }

    markersMutatingRef.current = false;

    const fitKey = points
      .map((p) => p.id)
      .sort()
      .join("|");
    if (fitKey !== lastFitKeyRef.current && points.length > 0) {
      lastFitKeyRef.current = fitKey;
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as L.LatLngTuple));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 5 });
      }
    }
  }, [points, selectedId, onSelectPoint, onPopupClosedForNodeId]);

  const pointsKey = points
    .map((p) => p.id)
    .sort()
    .join("|");

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    if (!selectedId) {
      map.closePopup();
      return;
    }

    const marker = markersByIdRef.current.get(selectedId);
    if (!marker) return;

    cluster.zoomToShowLayer(marker, () => {
      if (!marker.isPopupOpen()) {
        marker.openPopup();
      }
    });
  }, [selectedId, pointsKey]);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className={`nodes-world-map z-0 min-h-[min(70vh,560px)] w-full min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden ${className}`}
      />
      <button
        type="button"
        onClick={fitAllMarkers}
        className="nodes-map-reset-view absolute bottom-10 left-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]/95 text-[var(--section-icon-cyan-fg)] shadow-md backdrop-blur-sm transition-colors hover:border-[var(--border-medium)] hover:bg-[var(--bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--section-icon-cyan-fg)]/40"
        aria-label="Reset map view"
        title="Fit all markers"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>
    </div>
  );
});

export default NodesWorldMap;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
