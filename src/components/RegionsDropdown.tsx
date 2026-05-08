"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type RegionItem = { code: string; count: number };

function countryFlag(code: string): string {
  if (code.length !== 2) return "\u{1F310}";
  const cp1 = 0x1f1e6 + (code.charCodeAt(0) & 0x1f) - 1;
  const cp2 = 0x1f1e6 + (code.charCodeAt(1) & 0x1f) - 1;
  return String.fromCodePoint(cp1, cp2);
}

function providerGlyph(name: string): string {
  const t = name.trim();
  if (!t || t === "Unknown") return "\u{1F310}";
  const ch = t.charAt(0).toUpperCase();
  return /[A-Za-z0-9]/.test(ch) ? ch : "\u{1F310}";
}

type Mode = "regions" | "providers";

type Props = {
  regionCount: number;
  providerCount: number;
  regions: RegionItem[];
  providers: RegionItem[];
};

export default function RegionsDropdown({
  regionCount,
  providerCount,
  regions,
  providers,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("regions");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeList = mode === "regions" ? regions : providers;
  const activeCount = mode === "regions" ? regionCount : providerCount;
  const max = activeList[0]?.count ?? 1;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`group relative inline-flex min-h-9 items-stretch overflow-hidden rounded-[10px] border-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4e8dc] transition-[filter,transform,box-shadow] duration-200 ease-out ${
          open
            ? "border-[#2a140a] bg-[linear-gradient(165deg,#a85f36_0%,#73391b_36%,#5c2a14_72%,#3d1c0e_100%)] shadow-[inset_0_1px_0_rgba(255,200,160,0.22),inset_0_-3px_8px_rgba(0,0,0,0.5),0_7px_20px_rgba(35,12,4,0.55)]"
            : "border-[#2a140a] bg-[linear-gradient(165deg,#9a5530_0%,#6b3418_36%,#5c2a14_72%,#3d1c0e_100%)] shadow-[inset_0_1px_0_rgba(255,200,160,0.2),inset_0_-3px_8px_rgba(0,0,0,0.45),0_4px_16px_rgba(35,12,4,0.55)] hover:brightness-110 hover:saturate-105"
        }`}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        <span className="flex shrink-0 items-center justify-center border-r border-[#2a140a]/80 bg-black/15 px-2">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#ffd9bf]"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
          </svg>
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMode("regions");
            setOpen(true);
          }}
          className={`px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#cf8257]/45 ${
            mode === "regions"
              ? "bg-black/25 text-[#fff4ea]"
              : "text-[#f4e8dc]/75 hover:bg-black/10 hover:text-[#f4e8dc]"
          }`}
          aria-pressed={mode === "regions"}
        >
          Regions
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMode("providers");
            setOpen(true);
          }}
          className={`border-l border-[#2a140a]/80 px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#cf8257]/45 ${
            mode === "providers"
              ? "bg-black/25 text-[#fff4ea]"
              : "text-[#f4e8dc]/75 hover:bg-black/10 hover:text-[#f4e8dc]"
          }`}
          aria-pressed={mode === "providers"}
        >
          Providers
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={mode === "regions" ? "Open regions list" : "Open providers list"}
          className="inline-flex min-w-0 items-center gap-1.5 border-l border-[#2a140a]/80 px-2.5 py-1.5 pr-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#cf8257]/45 active:translate-y-0 active:brightness-95"
        >
          <span className="mono text-sm font-bold tabular-nums text-[#fff4ea]">{activeCount}</span>
          <motion.svg
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative top-px shrink-0 text-[#f4e8dc]/85 transition-colors group-hover:text-[#fff4ea]"
            aria-hidden
          >
            <path d="M2 3.5l3 3 3-3" />
          </motion.svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label={mode === "regions" ? "Regions" : "Providers"}
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
            style={{ originY: "top" }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] z-[600] w-[min(100vw-2rem,18rem)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[0_16px_48px_rgba(0,0,0,0.38)] backdrop-blur-md"
          >
            <div className="border-b border-[var(--border-subtle)] px-3.5 py-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {mode === "regions" ? "By country (ISO)" : "By ISP / org (ip-api)"}
              </span>
            </div>

            <div className="node-map-list-scroll max-h-64 overflow-y-auto px-1.5 pb-1.5 pt-1">
              {activeList.length === 0 ? (
                <p className="px-2 py-4 text-center text-[10px] text-[var(--text-muted)]">
                  {mode === "regions" ? "No region data." : "No provider data."}
                </p>
              ) : (
                activeList.map((r, i) => (
                  <motion.div
                    key={`${mode}-${r.code}`}
                    role="option"
                    aria-selected={false}
                    title={mode === "providers" ? r.code : undefined}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.18,
                      delay: i * 0.035,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--bg-card-hover)]"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--border-subtle)] text-[11px] font-bold leading-none text-[var(--text-primary)]"
                      aria-hidden
                    >
                      {mode === "regions" ? (
                        <span className="text-sm leading-none">{countryFlag(r.code)}</span>
                      ) : (
                        providerGlyph(r.code)
                      )}
                    </span>
                    {mode === "regions" ? (
                      <span className="mono w-7 shrink-0 text-[11px] font-bold text-[var(--text-primary)]">
                        {r.code}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      {mode === "providers" ? (
                        <div className="truncate text-[11px] font-medium leading-snug text-[var(--text-primary)]">
                          {r.code}
                        </div>
                      ) : null}
                      <div
                        className={`h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)] ${
                          mode === "providers" ? "mt-1" : ""
                        }`}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round((r.count / max) * 100)}%` }}
                          transition={{ duration: 0.35, delay: i * 0.035 + 0.08, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-[var(--section-icon-cyan-fg)]/70"
                        />
                      </div>
                    </div>
                    <span className="mono w-5 shrink-0 text-right text-[10px] tabular-nums text-[var(--text-muted)]">
                      {r.count}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
