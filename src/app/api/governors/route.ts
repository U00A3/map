import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const upstream = process.env.NODES_API_UPSTREAM?.trim();
  if (!upstream) {
    return NextResponse.json({ governors: [], error: "NODES_API_UPSTREAM not set" }, { status: 503 });
  }

  const base = upstream.replace(/\/+$/, "");
  const url = `${base}/api/governors`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);

  try {
    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store", signal: ac.signal });
    } finally {
      clearTimeout(t);
    }
    const body = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { governors: [], error: `Upstream HTTP ${res.status}` },
        { status: res.status },
      );
    }
    return NextResponse.json(body);
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "AbortError" ? "Upstream timeout (15s)" : e.message
        : "Upstream fetch failed";
    return NextResponse.json({ governors: [], error: msg }, { status: 502 });
  }
}
