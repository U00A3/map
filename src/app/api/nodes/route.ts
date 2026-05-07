import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { geoForHost, lookupHostsGeo } from "@/lib/ipApiGeo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeUpstream(raw: string): string {
  return raw.replace(/\/+$/, "");
}

type NodeLike = { host?: unknown };

async function attachGeoFields<T extends NodeLike>(nodes: T[]): Promise<T[]> {
  const geoMap = await lookupHostsGeo(nodes.map((n) => String(n.host ?? "")));
  return nodes.map((n) => {
    const host = String(n.host ?? "");
    const g = geoForHost(geoMap, host);
    if (!g) return n;
    return {
      ...n,
      geo_lat: g.lat,
      geo_lon: g.lon,
      geo_country: g.countryCode,
      geo_query: g.query ?? null,
      geo_isp: g.isp ?? null,
      geo_org: g.org ?? null,
      geo_as: g.asnLine ?? null,
      geo_asname: g.asname ?? null,
    };
  });
}

export async function GET() {
  const upstream = process.env.NODES_API_UPSTREAM?.trim();

  if (upstream) {
    try {
      const base = normalizeUpstream(upstream);
      const url = `${base}/api/nodes`;
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 25_000);
      let res: Response;
      try {
        res = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: ac.signal,
        });
      } finally {
        clearTimeout(t);
      }
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return NextResponse.json(
          { nodes: [], error: "Upstream returned non-JSON" },
          { status: 502 },
        );
      }
      if (!res.ok) {
        const err =
          body && typeof body === "object" && "error" in body
            ? String((body as { error?: unknown }).error)
            : `Upstream HTTP ${res.status}`;
        return NextResponse.json({ nodes: [], error: err }, { status: res.status });
      }
      if (!body || typeof body !== "object" || !Array.isArray((body as { nodes?: unknown }).nodes)) {
        return NextResponse.json(body);
      }
      const b = body as { nodes: NodeLike[]; [k: string]: unknown };
      const nodes = await attachGeoFields(b.nodes);
      return NextResponse.json({ ...b, nodes });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? "Upstream timeout (25s)"
            : e.message
          : "Upstream fetch failed";
      return NextResponse.json({ nodes: [], error: msg }, { status: 502 });
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const { rows } = await pool.query(`
        SELECT
          n.id,
          n.host,
          n.created_at,
          s.is_online,
          s.latency_ms,
          s.checked_at,
          s.response
        FROM nodes n
        LEFT JOIN latest_status s ON n.id = s.node_id
        ORDER BY n.created_at DESC
      `);
      const nodes = await attachGeoFields(rows as NodeLike[]);
      return NextResponse.json({ nodes });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DB error";
      return NextResponse.json({ nodes: [], error: msg }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      nodes: [],
      error: "Set NODES_API_UPSTREAM (proxy to main app) or DATABASE_URL in .env",
    },
    { status: 503 },
  );
}
