"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHAIN_POLL = 120_000;
const PRICE_POLL = 600_000;
const BLOCK_SAMPLE = 5;

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 152);
const RPC_URL = (process.env.NEXT_PUBLIC_RPC_URL || "").trim();

interface ChainStats {
  blockNumber: bigint;
  gasPriceNrbnt: string;
  avgBlockTime: number | null;
  tps: number | null;
}

interface PriceData {
  usd: number;
  change24h: number;
}

/** Same-origin proxy (`/api/rpc`) avoids CORS when the RPC host does not allow browser origins. */
async function rpcCall<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch("/api/rpc/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const j = (await res.json()) as { result?: T; error?: { message?: string } };
  if (!res.ok) throw new Error((j as { error?: string }).error || `RPC HTTP ${res.status}`);
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result as T;
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

function formatGweiFromWeiHex(hex: string): string {
  const wei = hexToBigInt(hex);
  const gwei = Number(wei) / 1e9;
  return gwei.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MapStandaloneNetworkStats() {
  const [chain, setChain] = useState<ChainStats | null>(null);
  const [price, setPrice] = useState<PriceData | null>(null);
  const mountedRef = useRef(true);

  const fetchChain = useCallback(async () => {
    if (!RPC_URL) return;
    try {
      const [bnHex, gpHex] = await Promise.all([
        rpcCall<string>("eth_blockNumber", []),
        rpcCall<string>("eth_gasPrice", []),
      ]);
      const bn = hexToBigInt(bnHex);
      const gasPriceNrbnt = formatGweiFromWeiHex(gpHex);

      let avgBlockTime: number | null = null;
      let tps: number | null = null;

      if (bn > BigInt(BLOCK_SAMPLE)) {
        const blockNumbers = Array.from({ length: BLOCK_SAMPLE + 1 }, (_, i) => bn - BigInt(i));
        const blocks = await Promise.all(
          blockNumbers.map((n) =>
            rpcCall<{ timestamp: string; transactions: unknown[] }>("eth_getBlockByNumber", [
              "0x" + n.toString(16),
              false,
            ]),
          ),
        );
        const t0 = hexToBigInt(blocks[0].timestamp);
        const t1 = hexToBigInt(blocks[BLOCK_SAMPLE].timestamp);
        const timeDiff = Number(t0 - t1);
        if (timeDiff > 0) {
          avgBlockTime = timeDiff / BLOCK_SAMPLE;
          const totalTxs = blocks
            .slice(0, BLOCK_SAMPLE)
            .reduce((sum, b) => sum + (Array.isArray(b.transactions) ? b.transactions.length : 0), 0);
          tps = totalTxs / timeDiff;
        }
      }

      if (mountedRef.current) {
        setChain({ blockNumber: bn, gasPriceNrbnt, avgBlockTime, tps });
      }
    } catch (e) {
      console.error("MapStandaloneNetworkStats chain:", e);
    }
  }, []);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=redbelly-network-token&vs_currencies=usd&include_24hr_change=true",
      );
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      const token = data["redbelly-network-token"];
      if (token && mountedRef.current) {
        setPrice({
          usd: token.usd ?? 0,
          change24h: token.usd_24h_change ?? 0,
        });
      }
    } catch (e) {
      console.error("MapStandaloneNetworkStats price:", e);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!RPC_URL) return;
    void fetchChain();
    void fetchPrice();
    const chainId = window.setInterval(() => void fetchChain(), CHAIN_POLL);
    const priceId = window.setInterval(() => void fetchPrice(), PRICE_POLL);
    return () => {
      mountedRef.current = false;
      window.clearInterval(chainId);
      window.clearInterval(priceId);
    };
  }, [fetchChain, fetchPrice]);

  const barClass =
    "flex items-center gap-2 text-[9px] sm:text-[10px] text-[var(--text-muted)] flex-nowrap min-h-[1.25rem] max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5";

  if (!RPC_URL) {
    return (
      <div className={barClass} aria-live="polite">
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="uppercase tracking-widest">Chain</span>
          <span className="mono text-[var(--text-secondary)]">{CHAIN_ID}</span>
        </span>
        <span className="text-[var(--border-bright)] select-none">·</span>
        <span className="uppercase tracking-widest text-[var(--text-muted)]">
          Set NEXT_PUBLIC_RPC_URL for live stats
        </span>
      </div>
    );
  }

  if (!chain) {
    return (
      <div className={barClass} aria-live="polite" aria-busy="true">
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="uppercase tracking-widest">Chain</span>
          <span className="mono text-[var(--text-secondary)]">{CHAIN_ID}</span>
        </span>
        <span className="text-[var(--border-bright)] select-none">·</span>
        <span className="animate-pulse uppercase tracking-widest text-[var(--text-muted)]">
          Syncing RPC…
        </span>
      </div>
    );
  }

  const changeColor = price && price.change24h >= 0 ? "text-green-500" : "text-red-400";
  const changeSign = price && price.change24h >= 0 ? "+" : "";

  const items: {
    label: string;
    value: string;
    extra?: string;
    extraClass?: string;
    compactOnly?: boolean;
  }[] = [
    ...(price
      ? [
          {
            label: "RBNT",
            value: `$${price.usd.toFixed(6)}`,
            extra: `(${changeSign}${price.change24h.toFixed(2)}%)`,
            extraClass: changeColor,
          },
        ]
      : []),
    { label: "Chain", value: String(CHAIN_ID) },
    { label: "Block", value: Number(chain.blockNumber).toLocaleString() },
    { label: "Gas", value: `${chain.gasPriceNrbnt} nRBNT` },
    ...(chain.tps !== null
      ? [{ label: "TPS", value: chain.tps.toFixed(3), compactOnly: true }]
      : []),
    ...(chain.avgBlockTime !== null
      ? [
          {
            label: "Avg block",
            value: `${chain.avgBlockTime.toFixed(1)}s`,
            compactOnly: true,
          },
        ]
      : []),
  ];

  return (
    <div className={barClass} aria-live="polite" aria-label="Network statistics">
      {items.map((item, i) => (
        <span
          key={`${item.label}-${i}`}
          className={`flex shrink-0 items-center gap-1.5 ${item.compactOnly ? "hidden sm:flex" : ""}`}
        >
          {i > 0 && <span className="text-[var(--border-bright)] select-none">·</span>}
          <span className="uppercase tracking-widest">{item.label}</span>
          <span className="mono text-[var(--text-secondary)]">{item.value}</span>
          {item.extra && <span className={`mono ${item.extraClass ?? ""}`}>{item.extra}</span>}
        </span>
      ))}
    </div>
  );
}
