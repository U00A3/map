import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function upstreamUrl(): string {
  return (process.env.RPC_UPSTREAM || process.env.NEXT_PUBLIC_RPC_URL || "").trim();
}

export async function POST(req: NextRequest) {
  const upstream = upstreamUrl();
  if (!upstream) {
    return NextResponse.json({ error: "RPC not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upstream RPC failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
