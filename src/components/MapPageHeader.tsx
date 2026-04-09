"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import MapStandaloneNetworkStats from "@/components/MapStandaloneNetworkStats";

type Props = {
  rightSlot?: ReactNode;
};

export default function MapPageHeader({ rightSlot }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-5 lg:px-10 backdrop-blur-xl"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 pr-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">Bellydash</span>
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              node dashboard & monitor
            </span>
          </div>
          <div className="ml-2 flex items-center gap-1.5">
            <div className="live-dot" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              Mainnet
            </span>
          </div>
        </div>
        <MapStandaloneNetworkStats />
      </div>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </motion.header>
  );
}
