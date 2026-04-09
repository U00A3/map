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
  tableEnsured = true;
}

export type HostGeoRow = {
  host: string;
  lat: number | null;
  lon: number | null;
  country_code: string | null;
  is_fail: boolean;
  expires_at: Date;
};

export async function loadHostGeoRows(hosts: string[]): Promise<Map<string, HostGeoRow>> {
  if (hosts.length === 0) return new Map();
  const lower = [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))];
  const { rows } = await pool.query<HostGeoRow>(
    `SELECT host, lat, lon, country_code, is_fail, expires_at
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
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    `INSERT INTO ${TABLE} (host, lat, lon, country_code, is_fail, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, false, $5, NOW())
     ON CONFLICT (host) DO UPDATE SET
       lat = EXCLUDED.lat,
       lon = EXCLUDED.lon,
       country_code = EXCLUDED.country_code,
       is_fail = false,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [host.toLowerCase(), lat, lon, countryCode, expiresAt],
  );
}

export async function upsertHostGeoFail(host: string, expiresAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO ${TABLE} (host, lat, lon, country_code, is_fail, expires_at, updated_at)
     VALUES ($1, NULL, NULL, NULL, true, $2, NOW())
     ON CONFLICT (host) DO UPDATE SET
       is_fail = true,
       lat = NULL,
       lon = NULL,
       country_code = NULL,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [host.toLowerCase(), expiresAt],
  );
}
