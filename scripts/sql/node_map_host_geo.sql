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
