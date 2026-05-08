/** Approximate lat/lon from hostname for map display (offline heuristic, not GeoIP). */

export type NodeMapStatus = "online" | "offline" | "unknown";

/** "offline" filter = all nodes that are not online (includes unknown + explicitly offline). */
export type MapNodeFilter = "all" | "online" | "offline";

export function filterMapPoints(points: MapNodePoint[], f: MapNodeFilter): MapNodePoint[] {
  if (f === "all") return points;
  if (f === "online") return points.filter((p) => p.status === "online");
  return points.filter((p) => p.status !== "online");
}

export type MapNodePoint = {
  id: string;
  host: string;
  lat: number;
  lon: number;
  /** Last probe: online / explicitly offline / not yet known */
  status: NodeMapStatus;
  /** ISO 3166-1 alpha-2 when rule matched; null for global hash fallback or generic mainnet rule */
  country: string | null;
  latencyMs: number | null;
  /** Nodes from UDP 6540 list (TSV), not on dashboard; distinct map style */
  source?: "dashboard" | "registry";
  /** Node is a registered governor (diamond marker on map) */
  isGovernor?: boolean;
  /** ip-api resolved IP (when Geo from API) */
  geoQuery?: string | null;
  geoIsp?: string | null;
  geoOrg?: string | null;
  /** ip-api `as` line */
  geoAs?: string | null;
  geoAsname?: string | null;
  /** True when coordinates came from ip-api cache (show ISP rows even if older cache has no isp yet) */
  geoFromApi?: boolean;
};

/** ISP / org / AS name for grouping (same order as map popup Provider line). */
export function providerLabelForPoint(p: MapNodePoint): string {
  const t = p.geoIsp?.trim() || p.geoOrg?.trim() || p.geoAsname?.trim();
  return t || "Unknown";
}

export type ApiNodeRow = {
  id: string | number;
  host: string;
  is_online: boolean | null;
  latency_ms?: number | null;
  /** Filled server-side (ip-api.com in `/api/nodes`), optional */
  geo_lat?: number | null;
  geo_lon?: number | null;
  geo_country?: string | null;
  geo_query?: string | null;
  geo_isp?: string | null;
  geo_org?: string | null;
  geo_as?: string | null;
  geo_asname?: string | null;
};

function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function wrapLon(lon: number): number {
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

/** Deterministic offset in degrees (elliptical so clusters look less grid-like). */
function jitter(seed: number, spreadDeg: number): [number, number] {
  const a = (seed & 0xffff) / 0xffff;
  const b = ((seed >> 16) & 0xffff) / 0xffff;
  const angle = a * Math.PI * 2;
  const r = Math.sqrt(b) * spreadDeg;
  return [Math.cos(angle) * r * 0.85, Math.sin(angle) * r * 0.55];
}

type Rule = {
  test: (h: string) => boolean;
  lat: number;
  lon: number;
  spread: number;
  country: string | null;
};

const RULES: Rule[] = [
  { test: (h) => /usyd|sydney/i.test(h), lat: -33.8688, lon: 151.2093, spread: 0.8, country: "AU" },
  {
    test: (h) =>
      /csiro|block8\.mainnet|redbellycsnet|redbellydrdre\.com\.au|camrbnt|drdrerbnt/i.test(h),
    lat: -27.47,
    lon: 153.03,
    spread: 3.5,
    country: "AU",
  },
  { test: (h) => /\.com\.au$/i.test(h) || /\.net\.au$/i.test(h), lat: -25.27, lon: 133.77, spread: 6, country: "AU" },
  { test: (h) => /\.au$/i.test(h), lat: -25.27, lon: 133.77, spread: 8, country: "AU" },
  { test: (h) => /rbn-htz|hetzner|htz-/i.test(h), lat: 50.4772, lon: 12.3649, spread: 1.8, country: "DE" },
  { test: (h) => /rbn-ovh|ovh-/i.test(h), lat: 50.6942, lon: 3.1746, spread: 2.5, country: "FR" },
  { test: (h) => /rbn-aws|aws-/i.test(h), lat: 39.8283, lon: -98.5795, spread: 11, country: "US" },
  { test: (h) => /rbn-gcp|gcp-/i.test(h), lat: 37.3861, lon: -122.0839, spread: 7, country: "US" },
  { test: (h) => /\.de$/i.test(h), lat: 51.1657, lon: 10.4515, spread: 2.8, country: "DE" },
  { test: (h) => /\.uk$/i.test(h), lat: 54.7, lon: -3.4, spread: 3, country: "GB" },
  { test: (h) => /\.fr$/i.test(h), lat: 46.6, lon: 2.2, spread: 4, country: "FR" },
  { test: (h) => /\.sg$/i.test(h), lat: 1.35, lon: 103.82, spread: 0.6, country: "SG" },
  { test: (h) => /\.jp$/i.test(h), lat: 36.2, lon: 138.25, spread: 4, country: "JP" },
  { test: (h) => /\.in$/i.test(h), lat: 22.35, lon: 78.96, spread: 8, country: "IN" },
  { test: (h) => /\.br$/i.test(h), lat: -14.24, lon: -51.93, spread: 10, country: "BR" },
  /** Indonesia (.id ccTLD: *.co.id, *.my.id, bare *.id) */
  { test: (h) => /\.id$/i.test(h), lat: -2.5, lon: 118, spread: 5, country: "ID" },
  /** Common gTLDs in community nodes: approximate regions with wide jitter (not GeoIP). */
  { test: (h) => /\.ltd$/i.test(h), lat: 54.7, lon: -3.4, spread: 3.5, country: "GB" },
  { test: (h) => /\.eu$/i.test(h), lat: 50.85, lon: 4.35, spread: 9, country: null },
  { test: (h) => /\.io$/i.test(h), lat: 51.5, lon: -0.12, spread: 7, country: "GB" },
  { test: (h) => /\.online$/i.test(h), lat: 22, lon: 12, spread: 24, country: null },
  { test: (h) => /\.xyz$/i.test(h), lat: 18, lon: -24, spread: 24, country: null },
  { test: (h) => /\.site$/i.test(h), lat: 40.7, lon: -74, spread: 12, country: "US" },
  { test: (h) => /\.app$/i.test(h), lat: 37.4, lon: -122.1, spread: 14, country: "US" },
  {
    test: (h) => /\.mainnet\.redbelly\.network$/i.test(h),
    lat: 15,
    lon: 10,
    spread: 28,
    country: null,
  },
  { test: (h) => /\.ovh$/i.test(h), lat: 48.86, lon: 2.35, spread: 4, country: "FR" },
  { test: (h) => /\.be$/i.test(h), lat: 50.85, lon: 4.35, spread: 2.5, country: "BE" },
  { test: (h) => /\.net$/i.test(h), lat: 40.7, lon: -74, spread: 18, country: "US" },
  { test: (h) => /\.org$/i.test(h), lat: 38.9, lon: -77, spread: 16, country: "US" },
  { test: (h) => /\.com$/i.test(h), lat: 37.77, lon: -122.42, spread: 22, country: "US" },
  { test: (h) => /\.cloud$/i.test(h), lat: 50.1, lon: 8.68, spread: 6, country: "DE" },
];

/** When no TLD rule and no GeoIP: jitter around land points (not random globe = ocean). */
const LAND_FALLBACK_SEEDS: [number, number][] = [
  [39.8, -98.6],
  [40.7, -74.0],
  [34.05, -118.25],
  [51.5, -0.12],
  [48.85, 2.35],
  [50.11, 8.68],
  [52.52, 13.41],
  [55.75, 37.62],
  [28.61, 77.21],
  [1.35, 103.82],
  [35.68, 139.76],
  [22.32, 114.17],
  [-33.87, 151.21],
  [-23.55, -46.63],
  [-34.6, -58.38],
  [19.43, -99.13],
  [43.65, -79.38],
  [45.5, -73.57],
  [60.17, 24.94],
  [59.33, 18.07],
  [50.45, 30.52],
  [25.2, 55.27],
  [-26.2, 28.04],
  [30.04, 31.24],
];

export function resolveHostGeo(host: string, nodeId: string | number): {
  lat: number;
  lon: number;
  country: string | null;
} {
  const h = host.toLowerCase();
  const seed = hash32(`${host}#${nodeId}`);
  for (const r of RULES) {
    if (r.test(h)) {
      const [dj, dk] = jitter(seed, r.spread);
      return {
        lat: clamp(r.lat + dj, -85, 85),
        lon: wrapLon(r.lon + dk),
        country: r.country,
      };
    }
  }
  const i = seed % LAND_FALLBACK_SEEDS.length;
  const [baseLat, baseLon] = LAND_FALLBACK_SEEDS[i]!;
  const [dj, dk] = jitter(seed ^ 0x9e3779b9, 9);
  return {
    lat: clamp(baseLat + dj, -60, 72),
    lon: wrapLon(baseLon + dk),
    country: null,
  };
}

export type RegistryGeoEntry = {
  lat: number;
  lon: number;
  countryCode?: string | null;
  query?: string | null;
  isp?: string | null;
  org?: string | null;
  asnLine?: string | null;
  asname?: string | null;
};

function rowStatus(is_online: boolean | null): NodeMapStatus {
  if (is_online === true) return "online";
  if (is_online === false) return "offline";
  return "unknown";
}

export function apiNodesToMapPoints(
  rows: ApiNodeRow[],
  governorHosts?: Set<string>,
): MapNodePoint[] {
  return rows.map((n) => {
    let lat: number;
    let lon: number;
    let country: string | null;

    if (
      typeof n.geo_lat === "number" &&
      typeof n.geo_lon === "number" &&
      Number.isFinite(n.geo_lat) &&
      Number.isFinite(n.geo_lon)
    ) {
      const seed = hash32(`${n.host}#${n.id}`);
      const [dj, dk] = jitter(seed, 0.12);
      lat = clamp(n.geo_lat + dj, -85, 85);
      lon = wrapLon(n.geo_lon + dk);
      country = n.geo_country ?? null;
    } else {
      const r = resolveHostGeo(n.host, n.id);
      lat = r.lat;
      lon = r.lon;
      country = r.country;
    }

    const usedIpApiGeo =
      typeof n.geo_lat === "number" &&
      typeof n.geo_lon === "number" &&
      Number.isFinite(n.geo_lat) &&
      Number.isFinite(n.geo_lon);

    const geoExtras = usedIpApiGeo
      ? {
          geoQuery: n.geo_query ?? null,
          geoIsp: n.geo_isp ?? null,
          geoOrg: n.geo_org ?? null,
          geoAs: n.geo_as ?? null,
          geoAsname: n.geo_asname ?? null,
          geoFromApi: true as const,
        }
      : {};

    return {
      id: String(n.id),
      host: n.host,
      lat,
      lon,
      status: rowStatus(n.is_online),
      country,
      latencyMs: n.latency_ms ?? null,
      source: "dashboard",
      isGovernor: governorHosts ? governorHosts.has(n.host.trim().toLowerCase()) : false,
      ...geoExtras,
    };
  });
}

type RegistryHostEntry = { host: string };

/** TSV list points only for hosts not already in API data (no duplicate markers). */
export function registryHostsToMapPoints(
  entries: RegistryHostEntry[],
  dashboardHostsLower: Set<string>,
  /** Key: host lower; from GET /api/registry-geo (ip-api cache) */
  geoByHost?: Record<string, RegistryGeoEntry | undefined>,
  governorHosts?: Set<string>,
): MapNodePoint[] {
  const out: MapNodePoint[] = [];
  for (const { host } of entries) {
    const h = host.trim();
    if (!h) continue;
    if (dashboardHostsLower.has(h.toLowerCase())) continue;
    const key = h.toLowerCase();
    const g = geoByHost?.[key];
    let lat: number;
    let lon: number;
    let country: string | null;
    if (g && Number.isFinite(g.lat) && Number.isFinite(g.lon)) {
      const seed = hash32(`${h}#reg`);
      const [dj, dk] = jitter(seed, 0.1);
      lat = clamp(g.lat + dj, -85, 85);
      lon = wrapLon(g.lon + dk);
      country = g.countryCode ?? null;
    } else {
      const geo = resolveHostGeo(h, `reg:${h}`);
      lat = geo.lat;
      lon = geo.lon;
      country = geo.country;
    }
    const usedRegGeo = g && Number.isFinite(g.lat) && Number.isFinite(g.lon);

    const geoExtras = usedRegGeo
      ? {
          geoQuery: g!.query ?? null,
          geoIsp: g!.isp ?? null,
          geoOrg: g!.org ?? null,
          geoAs: g!.asnLine ?? null,
          geoAsname: g!.asname ?? null,
          geoFromApi: true as const,
        }
      : {};

    out.push({
      id: `reg:${h}`,
      host: h,
      lat,
      lon,
      country,
      status: "unknown",
      latencyMs: null,
      source: "registry",
      isGovernor: governorHosts ? governorHosts.has(key) : false,
      ...geoExtras,
    });
  }
  return out;
}
