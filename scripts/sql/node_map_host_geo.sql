-- Optional: run once if you prefer to create the table manually.
-- Otherwise the app calls CREATE TABLE IF NOT EXISTS on first Geo request when GEO_CACHE_USE_DATABASE=true.

CREATE TABLE IF NOT EXISTS node_map_host_geo (
  host TEXT PRIMARY KEY,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  country_code TEXT,
  is_fail BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_map_host_geo_expires ON node_map_host_geo (expires_at);

-- Added by app migration (ensureHostGeoTable); optional manual run:
-- ALTER TABLE node_map_host_geo ADD COLUMN IF NOT EXISTS resolved_ip TEXT;
-- ALTER TABLE node_map_host_geo ADD COLUMN IF NOT EXISTS isp TEXT;
-- ALTER TABLE node_map_host_geo ADD COLUMN IF NOT EXISTS org TEXT;
-- ALTER TABLE node_map_host_geo ADD COLUMN IF NOT EXISTS asn_line TEXT;
-- ALTER TABLE node_map_host_geo ADD COLUMN IF NOT EXISTS asname TEXT;
