import { NextResponse } from "next/server";
import { loadUdpHostsJson } from "@/lib/loadUdpHostsJson";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DNS list from `src/data/udp6540-hosts.json` (from `hosts/udp6540_latest.tsv` via sync); fresh after sync + restart. */
export async function GET() {
  try {
    const data = loadUdpHostsJson();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "read error";
    return NextResponse.json({ hosts: [], error: msg }, { status: 500 });
  }
}
