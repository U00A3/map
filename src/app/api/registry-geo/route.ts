import { NextResponse } from "next/server";
import { loadUdpHostsJson } from "@/lib/loadUdpHostsJson";
import { lookupHostsGeo } from "@/lib/ipApiGeo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns GeoIP (ip-api cache) for hosts on the current DNS list (file on disk).
 * First responses may have resolved < total; background worker fills cache (~40/min).
 */
export async function GET() {
  const hosts = loadUdpHostsJson().hosts.map((x) => x.host);
  const map = await lookupHostsGeo(hosts);
  const geo: Record<string, { lat: number; lon: number; countryCode: string | null }> = {};
  for (const h of hosts) {
    const g = map.get(h.toLowerCase());
    if (g) geo[h.toLowerCase()] = { lat: g.lat, lon: g.lon, countryCode: g.countryCode };
  }
  return NextResponse.json({
    geo,
    total: hosts.length,
    resolved: Object.keys(geo).length,
  });
}
