import { pool } from "@/lib/db";

const TABLE = "node_map_host_geo";

let tableEnsured = false;

export async function ensureHostGeoTable(): Promise<void> {
  if (tableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      host TEXT PRIMARY KEY,
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      country_code TEXT,
      is_fail BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_node_map_host_geo_expires ON ${TABLE} (expires_at);
  `);
  for (const stmt of [
    `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS resolved_ip TEXT`,
    `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS isp TEXT`,
    `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS org TEXT`,
    `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS asn_line TEXT`,
    `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS asname TEXT`,
  ]) {
    await pool.query(stmt);
  }
  tableEnsured = true;
}

export type HostGeoRow = {
  host: string;
  lat: number | null;
  lon: number | null;
  country_code: string | null;
  resolved_ip: string | null;
  isp: string | null;
  org: string | null;
  asn_line: string | null;
  asname: string | null;
  is_fail: boolean;
  expires_at: Date;
};

export async function loadHostGeoRows(hosts: string[]): Promise<Map<string, HostGeoRow>> {
  if (hosts.length === 0) return new Map();
  const lower = [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))];
  const { rows } = await pool.query<HostGeoRow>(
    `SELECT host, lat, lon, country_code, resolved_ip, isp, org, asn_line, asname, is_fail, expires_at
     FROM ${TABLE} WHERE host = ANY($1::text[])`,
    [lower],
  );
  const m = new Map<string, HostGeoRow>();
  for (const r of rows) {
    m.set(r.host.toLowerCase(), r);
  }
  return m;
}

export async function upsertHostGeoOk(
  host: string,
  lat: number,
  lon: number,
  countryCode: string | null,
  resolvedIp: string | null,
  isp: string | null,
  org: string | null,
  asnLine: string | null,
  asname: string | null,
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    `INSERT INTO ${TABLE} (host, lat, lon, country_code, resolved_ip, isp, org, asn_line, asname, is_fail, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, NOW())
     ON CONFLICT (host) DO UPDATE SET
       lat = EXCLUDED.lat,
       lon = EXCLUDED.lon,
       country_code = EXCLUDED.country_code,
       resolved_ip = EXCLUDED.resolved_ip,
       isp = EXCLUDED.isp,
       org = EXCLUDED.org,
       asn_line = EXCLUDED.asn_line,
       asname = EXCLUDED.asname,
       is_fail = false,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [host.toLowerCase(), lat, lon, countryCode, resolvedIp, isp, org, asnLine, asname, expiresAt],
  );
}

export async function upsertHostGeoFail(host: string, expiresAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO ${TABLE} (host, lat, lon, country_code, resolved_ip, isp, org, asn_line, asname, is_fail, expires_at, updated_at)
     VALUES ($1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, $2, NOW())
     ON CONFLICT (host) DO UPDATE SET
       is_fail = true,
       lat = NULL,
       lon = NULL,
       country_code = NULL,
       resolved_ip = NULL,
       isp = NULL,
       org = NULL,
       asn_line = NULL,
       asname = NULL,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [host.toLowerCase(), expiresAt],
  );
}
