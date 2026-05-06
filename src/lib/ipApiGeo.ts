/**
 * GeoIP via ip-api.com (free: HTTP, ~45 req/min per server IP, not per hour).
 * @see https://ip-api.com/docs/api:json
 *
 * - /api/nodes responses use cache only (memory + file or Postgres); missing entry: client uses heuristics.
 * - Missing hosts are queued for background fill (~40 calls/min) without blocking the request.
 *
 * Set GEO_CACHE_USE_DATABASE=true and DATABASE_URL to persist cache in table `node_map_host_geo`.
 *
 * Successful ip-api lookups are pinned by default: no repeat requests for that host (only new / missing
 * hosts hit the API). Set GEO_REFRESH_SUCCESS_MS to a positive value to re-fetch after that interval.
 */

import path from "path";
import {
  ensureHostGeoTable,
  loadHostGeoRows,
  upsertHostGeoFail,
  upsertHostGeoOk,
  type HostGeoRow,
} from "@/lib/hostGeoPg";

const IP_API_FIELDS = "status,message,lat,lon,countryCode,query";

function envInt(name: string, def: number): number {
  const v = process.env[name]?.trim();
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const FAIL_TTL_MS = 5 * 60 * 1000;
const NET_ERR_TTL_MS = 2 * 60 * 1000;

/** 0 = pin successful coords (no ip-api refresh for known hosts). >0 = refresh success after this many ms */
function getSuccessRefreshMs(): number {
  const v = process.env.GEO_REFRESH_SUCCESS_MS?.trim();
  if (v === undefined || v === "") return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const SUCCESS_REFRESH_MS = getSuccessRefreshMs();
/** ~10y used for DB/memory expiry when success is pinned (no periodic refetch) */
const SUCCESS_PINNED_TTL_MS = 365 * 24 * 60 * 60 * 1000 * 10;

/** Min interval between API calls (~40/min, margin under 45/min limit) */
const MIN_INTERVAL_MS = envInt("IP_API_MIN_INTERVAL_MS", Math.ceil(60_000 / 40));

type Cached =
  | {
      lat: number;
      lon: number;
      countryCode: string | null;
      expires: number;
    }
  | {
      fail: true;
      expires: number;
    };

const cache = new Map<string, Cached>();

export type IpApiGeoResult = {
  lat: number;
  lon: number;
  countryCode: string | null;
};

function usePostgresStore(): boolean {
  const v = process.env.GEO_CACHE_USE_DATABASE?.trim().toLowerCase();
  if (v !== "1" && v !== "true" && v !== "yes") return false;
  return Boolean(process.env.DATABASE_URL?.trim());
}

function cacheFilePath(): string {
  const raw = process.env.GEO_CACHE_PATH?.trim();
  if (raw) return raw;
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ".cache",
    "ip-api-geo.json",
  );
}

function isEnabled(): boolean {
  const v = process.env.IP_API_GEO?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

let diskLoaded = false;

/** Load JSON file cache into memory (once). Used for file mode or Postgres error fallback. */
function loadDiskCacheFromFile(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  const file = cacheFilePath();
  try {
    const fs = require("fs") as typeof import("fs");
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, "utf-8");
    const data = JSON.parse(raw) as Record<string, Cached>;
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && typeof (v as Cached).expires === "number") {
        cache.set(k.toLowerCase(), v);
      }
    }
  } catch {
    /* ignore */
  }
}

function loadDiskCacheOnce(): void {
  if (usePostgresStore()) return;
  loadDiskCacheFromFile();
}

function applyDbRowsToMemory(rows: Map<string, HostGeoRow>): void {
  for (const [key, r] of rows) {
    const exp = r.expires_at.getTime();
    if (r.is_fail) {
      cache.set(key, { fail: true, expires: exp });
    } else if (r.lat != null && r.lon != null && Number.isFinite(r.lat) && Number.isFinite(r.lon)) {
      cache.set(key, {
        lat: r.lat,
        lon: r.lon,
        countryCode: r.country_code,
        expires: exp,
      });
    }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersistCache(): void {
  if (usePostgresStore()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const fs = require("fs") as typeof import("fs");
      const file = cacheFilePath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const obj: Record<string, Cached> = {};
      for (const [k, v] of cache) obj[k] = v;
      fs.writeFileSync(file, JSON.stringify(obj), "utf-8");
    } catch {
      /* ignore */
    }
  }, 400);
}

function nowCached(key: string, t: number): IpApiGeoResult | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if ("lat" in hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) {
    // Stale-while-revalidate: keep showing last ip-api coords while expires is past and
    // needsNetworkFetch queues a refresh. Returning undefined here made /api/nodes omit
    // geo_* so the client fell back to hostname heuristics (often wrong / mid-ocean).
    return { lat: hit.lat, lon: hit.lon, countryCode: hit.countryCode };
  }
  if ("fail" in hit && hit.fail) return undefined;
  if (hit.expires <= t) return undefined;
  return undefined;
}

function needsNetworkFetch(host: string, t: number): boolean {
  const key = host.toLowerCase();
  const hit = cache.get(key);
  if (!hit) return true;
  if ("lat" in hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) {
    if (SUCCESS_REFRESH_MS === 0) return false;
    return hit.expires <= t;
  }
  if ("fail" in hit && hit.fail) {
    return hit.expires <= t;
  }
  if (hit.expires <= t) return true;
  return true;
}

async function fetchGeoFromApi(host: string): Promise<IpApiGeoResult | null> {
  const key = host.toLowerCase();
  const now = Date.now();
  const url = `http://ip-api.com/json/${encodeURIComponent(host)}?fields=${IP_API_FIELDS}`;
  const expiresFailApi = new Date(now + FAIL_TTL_MS);
  const expiresFailNet = new Date(now + NET_ERR_TTL_MS);
  const successTtlMs = SUCCESS_REFRESH_MS > 0 ? SUCCESS_REFRESH_MS : SUCCESS_PINNED_TTL_MS;
  const expiresOk = new Date(now + successTtlMs);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const j = (await res.json()) as {
      status?: string;
      lat?: number;
      lon?: number;
      countryCode?: string;
    };
    if (j.status !== "success" || typeof j.lat !== "number" || typeof j.lon !== "number") {
      cache.set(key, { fail: true, expires: now + FAIL_TTL_MS });
      if (usePostgresStore()) {
        try {
          await upsertHostGeoFail(key, expiresFailApi);
        } catch (e) {
          console.error("[ipApiGeo] postgres upsert fail:", e);
        }
      } else {
        schedulePersistCache();
      }
      return null;
    }
    const out: IpApiGeoResult = {
      lat: j.lat,
      lon: j.lon,
      countryCode: j.countryCode ?? null,
    };
    cache.set(key, {
      lat: out.lat,
      lon: out.lon,
      countryCode: out.countryCode,
      expires: now + successTtlMs,
    });
    if (usePostgresStore()) {
      try {
        await upsertHostGeoOk(key, out.lat, out.lon, out.countryCode, expiresOk);
      } catch (e) {
        console.error("[ipApiGeo] postgres upsert ok:", e);
      }
    } else {
      schedulePersistCache();
    }
    return out;
  } catch {
    cache.set(key, { fail: true, expires: now + NET_ERR_TTL_MS });
    if (usePostgresStore()) {
      try {
        await upsertHostGeoFail(key, expiresFailNet);
      } catch (e) {
        console.error("[ipApiGeo] postgres upsert fail (net):", e);
      }
    } else {
      schedulePersistCache();
    }
    return null;
  }
}

const backfillQueue: string[] = [];
const queued = new Set<string>();
let workerChain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBackfillWorker(): Promise<void> {
  while (backfillQueue.length > 0) {
    const host = backfillQueue.shift()!;
    const key = host.toLowerCase();
    queued.delete(key);
    const t = Date.now();
    if (!needsNetworkFetch(host, t)) continue;
    await fetchGeoFromApi(host);
    await sleep(MIN_INTERVAL_MS);
  }
}

function enqueueBackfill(hosts: string[]): void {
  if (!isEnabled()) return;
  loadDiskCacheOnce();
  const t = Date.now();
  for (const h of hosts) {
    const host = h.trim();
    if (!host) continue;
    const key = host.toLowerCase();
    if (!needsNetworkFetch(host, t)) continue;
    if (queued.has(key)) continue;
    queued.add(key);
    backfillQueue.push(host);
  }
  if (backfillQueue.length === 0) return;
  workerChain = workerChain
    .then(() => runBackfillWorker())
    .catch(() => {});
}

/**
 * Returns only entries already in cache (fresh). Does not block on network.
 * Starts background backfill for hosts without pinned success or after fail cooldown.
 */
export async function lookupHostsGeo(hosts: string[]): Promise<Map<string, IpApiGeoResult>> {
  const out = new Map<string, IpApiGeoResult>();
  if (!isEnabled() || hosts.length === 0) return out;

  const unique = [...new Set(hosts.map((h) => h.trim()).filter(Boolean))];
  const t = Date.now();

  if (usePostgresStore()) {
    try {
      await ensureHostGeoTable();
      const rows = await loadHostGeoRows(unique);
      applyDbRowsToMemory(rows);
    } catch (e) {
      console.error("[ipApiGeo] postgres cache load failed, falling back to file cache:", e);
      loadDiskCacheFromFile();
    }
  } else {
    loadDiskCacheOnce();
  }

  for (const h of unique) {
    const key = h.toLowerCase();
    const g = nowCached(key, t);
    if (g) out.set(key, g);
  }

  enqueueBackfill(unique);
  return out;
}

export function geoForHost(map: Map<string, IpApiGeoResult>, host: string): IpApiGeoResult | undefined {
  return map.get(host.trim().toLowerCase());
}
