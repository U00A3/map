# Bellydash Node Map - technical reference

Operational and developer documentation: data flow, GeoIP, env vars, APIs, deploy scripts. For a high-level introduction see [`README.md`](README.md). For **updating the DNS list** (JSON → probe → `udp6540_latest.tsv` → sync) see [`docs/wezly-w-bazie-danych.md`](docs/wezly-w-bazie-danych.md).

---

## Requirements

- **Node.js** 20+ (recommended)
- **Python 3** for `hosts/sync-udp6540-hosts.py` (builds the DNS list from TSV)
- Production: `npm run build` + `npm start` (or PM2 / systemd)
- **Optional:** PostgreSQL if you use `DATABASE_URL` for nodes and/or **persistent Geo cache** (see below)

## Quick start (local)

```bash
cd map
cp .env.example .env.local   # if present
# Fill .env / .env.local (at least NODES_API_UPSTREAM or DATABASE_URL)
# DNS list for the map: hosts/udp6540_latest.tsv (required for npm run build prebuild)
npm install
npm run dev
```

Default dev URL: **http://localhost:3101** (`package.json`). Change the port in the `dev` script if needed.

## Data sources on the map

| Source | Description |
|--------|-------------|
| **Dashboard** | `GET /api/nodes/` proxies to `{NODES_API_UPSTREAM}/api/nodes` or SQL from Postgres (`DATABASE_URL`). Markers reflect online / offline / unknown. Positions: **ip-api.com** (when enabled) plus in-memory/DB/file cache, or **hostname heuristics** if no cached Geo. |
| **Governors** | `GET /api/governors/` proxies to `{NODES_API_UPSTREAM}/api/governors` (trailing slash tolerated upstream). Hostnames are matched case-insensitively; those nodes get **governor** styling (map, clusters, sidebar). Fetched on load and with the same **30 s** refresh interval as nodes. |
| **DNS list (TSV)** | Canonical file **`hosts/udp6540_latest.tsv`** → after **`npm run sync:udp6540`** you get `src/data/udp6540-hosts.json`. **Runtime:** `GET /api/udp-hosts/` reads JSON from disk. **After a TSV-only change, sync + process restart is enough** without `next build` (once the app with this mechanism is deployed). Gray / neutral markers: hosts on the list that are not on the dashboard. Optional env **`UDP6540_TSV`** overrides the input path for the sync script. |

The client merges dashboard and registry hosts into one list; duplicates (same hostname on dashboard and DNS list) appear once as a dashboard point.

## UI overview (maintainers)

| Area | Components / notes |
|------|---------------------|
| **Header** | `MapPageHeader` - branding, live badge, `MapStandaloneNetworkStats`; optional **`rightSlot`**: Dashboard CTA (`DashboardCtaLink`, links to `NEXT_PUBLIC_MAIN_APP_URL`). |
| **Hero** | Title, copy, **`RegionsDropdown`** (rusty-metal trigger + Framer Motion panel, country breakdown + emoji flags). |
| **Sidebar** | **`NodeListSidebar`** - search, filter chips, list rows; selecting a map marker scrolls the list to that host. |
| **Map** | `NodesWorldMap` - clusters (amber tint when any child is a governor), individual governor markers, popups, optional fit/reset control. |
| **Footer** | `FooterDiscordSupport`, GitHub chip (`span`, not a link while private), “Powered by 1F592”. Styles: `.footer-github-chip`, `.footer-discord-badge` in `globals.css`. |
| **Legend** | `MapCapabilitiesSection` |

## GeoIP (ip-api.com) and cache

- The free HTTP API is limited to **~45 requests per minute per server IP**. Going over returns **HTTP 429**; repeated abuse can **ban the IP for one hour**. Response headers **`X-Rl`** / **`X-Ttl`** describe remaining quota (see [ip-api docs](https://ip-api.com/docs/api:json)).
- **ip-api is still used** to *obtain* coordinates for hostnames (and **ISP/ASN** fields `isp`, `org`, `as`, `asname`, `query` in the same request). Results are stored in a **cache** (Postgres and/or JSON file). Map popups show **IP**, **Provider**, **ASN** when data comes from ip-api.
- **`fail` cache entries** (API error or network error) use a short cooldown (minutes), then the worker **retries**. Successful coordinates are **not** repeatedly refetched by default (see **pinned success** below).
- If there is no valid cached Geo for a host, the map falls back to **`resolveHostGeo()`** in `src/lib/nodeMapGeo.ts` (hostname rules + jitter) - points may look “off” compared to real IP location.

### Where cache is stored

| Mode | Storage | When it is used |
|------|---------|-----------------|
| **File** (default) | `.cache/ip-api-geo.json` under the app working directory (override with `GEO_CACHE_PATH`) | `GEO_CACHE_USE_DATABASE` is unset/false, or no `DATABASE_URL` for DB mode |
| **PostgreSQL** | Table **`node_map_host_geo`** (created automatically on first use, or run `scripts/sql/node_map_host_geo.sql`) | `GEO_CACHE_USE_DATABASE=true` **and** `DATABASE_URL` is set |

With Postgres, successful/failed lookups are **upserted** into the DB; the JSON file is **not** written for Geo in that mode.

### Pinned successful lookups (default)

- If **`GEO_REFRESH_SUCCESS_MS` is unset or `0`** (default): after a **successful** ip-api response for a host, the app **does not call ip-api again** for that host. Only **new** hostnames (or hosts still missing Geo / in `fail` cooldown) are resolved in the background. Stored expiry is long (~10 years) for bookkeeping.
- If you want periodic refresh, set e.g. **`GEO_REFRESH_SUCCESS_MS=86400000`** (24 hours). **Restart** the Node process after changing env. While a success row is past `expires_at`, the API still returns the **last known** lat/lon (**stale-while-revalidate**); the background worker refetches and then updates. (Previously, omitting coords during that window forced **hostname heuristics**, which often misplaced markers.) For a one-time mass refetch after enabling refresh on an old DB, you can still run `UPDATE node_map_host_geo SET expires_at = NOW() - INTERVAL '1 second' WHERE is_fail = false;` (burst spread over **`IP_API_MIN_INTERVAL_MS`**).

### Background worker

- Backfill runs at roughly **`IP_API_MIN_INTERVAL_MS`** (default ~1500 ms → ~40 calls/min) to stay under the free-tier limit.
- **`/api/registry-geo/`** must be requested with a **trailing slash** if `trailingSlash: true` in `next.config.ts` (e.g. `fetch("/api/registry-geo/")`) to avoid **308 redirects** behind some proxies (e.g. Cloudflare).

### Client resilience

If **`/api/udp-hosts/`** or **`/api/nodes/`** fails transiently, the UI **keeps the last successful list** instead of clearing it, so the map does not empty until the next successful poll.

## Scripts (server / deploy)

| Script | What it does |
|--------|--------------|
| `npm run sync:udp6540` | TSV → `src/data/udp6540-hosts.json` (needs Python, tab-separated CSV) |
| `./scripts/updateUDPlist.sh` | `sync` + **`pm2 restart node-map`**: update DNS list only, no build. `--build` adds `next build`. `--no-reload`: sync only |
| `./deploy.sh` | `npm install` → `npm run build` (prebuild runs sync) → `pm2 restart`. Flags: `--no-install`, `--pull` |

First time after code changes use **`./deploy.sh`**; later edits to **`hosts/udp6540_latest.tsv`** only → **`./scripts/updateUDPlist.sh`**.

## API endpoints (short)

- **`/api/nodes/`** - dashboard nodes (+ Geo fields when `IP_API_GEO` is on and cache has data).
- **`/api/governors/`** - proxies `GET {NODES_API_UPSTREAM}/api/governors` (or `/api/governors/` upstream if the server redirects).
- **`/api/udp-hosts/`** - DNS list JSON (`hosts[]`), `Cache-Control: no-store`.
- **`/api/registry-geo/`** - Geo cache snapshot for hosts on the current DNS list (background fill for missing/failed entries).
- **`/api/rpc/`** - JSON-RPC proxy (network header).

## Environment variables

| Variable | Where | Description |
|----------|--------|-------------|
| `NODES_API_UPSTREAM` | server | **Recommended on a separate VPS.** Main app origin **without** trailing `/`, e.g. `https://your-dashboard.example.com`. Server calls `GET {origin}/api/nodes` and governors at `{origin}/api/governors`. |
| `DATABASE_URL` | server | Postgres connection string. Used for **direct `/api/nodes` SQL** when upstream is not set, and for **Geo cache table** when `GEO_CACHE_USE_DATABASE=true`. **`NODES_API_UPSTREAM` wins** for node list if set. |
| `GEO_CACHE_USE_DATABASE` | server | `true` / `1` / `yes`: persist ip-api Geo cache in Postgres table **`node_map_host_geo`** (requires `DATABASE_URL`). |
| `IP_API_GEO` | server | Default: on. Set `0` / `false` / `off` to disable ip-api (heuristics only). |
| `GEO_REFRESH_SUCCESS_MS` | server | **Empty or `0`:** do not re-query ip-api for hosts that already have successful Geo (only new/missing/fail retry). **Positive value:** refresh successful entries after that many milliseconds (e.g. `86400000` = 24 h). |
| `GEO_CACHE_PATH` | server | Optional path to JSON Geo cache file; default `.cache/ip-api-geo.json` under the app cwd (used when not using DB for cache). |
| `IP_API_MIN_INTERVAL_MS` | server | Minimum delay between background ip-api calls (default ~1500 ms). |
| `NEXT_PUBLIC_MAIN_APP_URL` | client | Origin for the **Dashboard** button in the header (no trailing `/`), e.g. `https://your-dashboard.example.com`. |
| `NEXT_PUBLIC_CHAIN_ID` | client | Chain ID in stats bar (e.g. `151`). |
| `NEXT_PUBLIC_RPC_URL` | server | JSON-RPC for `/api/rpc/`. Empty = message in UI. |

Example `.env` (proxy upstream only, file-based Geo cache):

```env
NODES_API_UPSTREAM=https://your-dashboard.example.com
NEXT_PUBLIC_MAIN_APP_URL=https://your-dashboard.example.com
NEXT_PUBLIC_CHAIN_ID=151
NEXT_PUBLIC_RPC_URL=https://governors.mainnet.redbelly.network
```

Example with **Postgres Geo cache** (same DB as elsewhere or a dedicated database):

```env
NODES_API_UPSTREAM=https://your-dashboard.example.com
NEXT_PUBLIC_MAIN_APP_URL=https://your-dashboard.example.com
DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/dbname
GEO_CACHE_USE_DATABASE=true
```

## `/api/nodes` resolution order

1. If `NODES_API_UPSTREAM` is set → proxy to `{UPSTREAM}/api/nodes`.
2. Else if `DATABASE_URL` → SQL on `nodes` + `latest_status`.
3. Else → `503` with configuration message.

## Production deploy

```bash
npm install
npm run build
NODE_ENV=production npm start
```

Default port **3101** (`next start -p 3101` in `package.json`). On servers **PM2** is common (e.g. `pm2 start npm --name node-map -- start` in the project dir).

**Process restarts after reboot:** PM2 does not resurrect apps until you run **`pm2 save`** and **`pm2 startup`** (follow the printed command as root) so the map starts again after a server reboot.

After changing env vars used by the running process, prefer **`pm2 restart node-map --update-env`**.

Reverse proxy (nginx/Caddy) with TLS; firewall 80/443 only if the app sits behind the proxy.

### systemd example

```ini
[Unit]
Description=Bellydash Node Map
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/node-map
Environment=NODE_ENV=production
EnvironmentFile=/opt/node-map/.env
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Adjust `WorkingDirectory` and paths to `node`/`npm`.

## Sync with main repo

After map changes in main `frontend/`, sync e.g.:

- `src/lib/nodeMapGeo.ts`
- `src/lib/ipApiGeo.ts`
- `src/components/NodesWorldMap.tsx`
- `src/components/NodeListSidebar.tsx`
- `src/components/RegionsDropdown.tsx`
- `src/components/FooterDiscordSupport.tsx`
- `src/components/MapPageHeader.tsx`, `MapCapabilitiesSection.tsx`, `DashboardCtaLink.tsx`
- `src/app/api/governors/route.ts`
- Leaflet and footer styles in `src/app/globals.css` (`.nodes-*`, `.nodes-world-map`, `.node-map-list-scroll`, `.footer-github-chip`, `.footer-discord-badge`)
- `src/app/page.tsx`
- `hosts/udp6540_latest.tsv`, `hosts/sync-udp6540-hosts.py`, `scripts/updateUDPlist.sh`

Header: **`MapPageHeader`** + **`MapStandaloneNetworkStats`** (no RainbowKit/wagmi).

## Moving the folder

Copy the whole project directory (without `node_modules` and `.next`), then `npm install && npm run build && npm start`. Do not commit secrets; `.env` / `.env.local` are in `.gitignore`.

## Security notes

- `/api/nodes` (and governors) on the dashboard must be **reachable from the map server** (network / firewall). If protected by token, use a header in the proxy and the same secret on the map side.
- `NODES_API_UPSTREAM` must point to a **trusted** host.
- If you run PostgreSQL on the same machine for Geo cache, restrict it to **localhost** (`listen_addresses`, `pg_hba.conf`) so the database is not exposed on the public network.
