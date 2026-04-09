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

type Props = {
  value: number;
  regions: RegionItem[];
};

export default function RegionsDropdown({ value, regions }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const max = regions[0]?.count ?? 1;

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group relative inline-flex min-h-9 items-center gap-2 rounded-[10px] border-2 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4e8dc] transition-[filter,transform,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#cf8257]/45 active:translate-y-0 active:brightness-95 ${
          open
            ? "border-[#2a140a] bg-[linear-gradient(165deg,#a85f36_0%,#73391b_36%,#5c2a14_72%,#3d1c0e_100%)] shadow-[inset_0_1px_0_rgba(255,200,160,0.22),inset_0_-3px_8px_rgba(0,0,0,0.5),0_7px_20px_rgba(35,12,4,0.55)]"
            : "border-[#2a140a] bg-[linear-gradient(165deg,#9a5530_0%,#6b3418_36%,#5c2a14_72%,#3d1c0e_100%)] shadow-[inset_0_1px_0_rgba(255,200,160,0.2),inset_0_-3px_8px_rgba(0,0,0,0.45),0_4px_16px_rgba(35,12,4,0.55)] hover:-translate-y-px hover:brightness-110 hover:saturate-105"
        }`}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-black/20 text-[#ffd9bf]">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
          </svg>
        </span>
        <span className="text-[#f4e8dc]">Regions</span>
        <span className="mono text-sm font-bold tabular-nums text-[#fff4ea]">
          {value}
        </span>
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
          className="relative top-px text-[#f4e8dc]/85 transition-colors group-hover:text-[#fff4ea]"
          aria-hidden
        >
          <path d="M2 3.5l3 3 3-3" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Regions"
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
            style={{ originY: "top" }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] z-[600] w-56 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[0_16px_48px_rgba(0,0,0,0.38)] backdrop-blur-md"
          >
            <div className="border-b border-[var(--border-subtle)] px-3.5 py-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Node distribution
              </span>
            </div>

            <div className="node-map-list-scroll max-h-64 overflow-y-auto px-1.5 pb-1.5 pt-1">
              {regions.length === 0 ? (
                <p className="px-2 py-4 text-center text-[10px] text-[var(--text-muted)]">
                  No region data.
                </p>
              ) : (
                regions.map((r, i) => (
                  <motion.div
                    key={r.code}
                    role="option"
                    aria-selected={false}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.18,
                      delay: i * 0.035,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--bg-card-hover)]"
                  >
                    <span className="shrink-0 text-sm leading-none" aria-hidden>
                      {countryFlag(r.code)}
                    </span>
                    <span className="mono w-7 shrink-0 text-[11px] font-bold text-[var(--text-primary)]">
                      {r.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
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
