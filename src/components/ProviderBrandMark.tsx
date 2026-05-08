"use client";

import { useEffect, useMemo, useState } from "react";
import { providerBrandSlug, simpleIconCdnUrl } from "@/lib/providerBrandIcons";

type Props = {
  label: string;
  /** Shown when no brand match or image fails to load */
  fallback: (label: string) => string;
  /** Pixel size (square) */
  size?: number;
  className?: string;
};

/**
 * Simple Icons brand logo when `label` matches a known ISP/org pattern; otherwise `fallback`.
 */
export default function ProviderBrandMark({ label, fallback, size = 20, className = "" }: Props) {
  const slug = useMemo(() => providerBrandSlug(label), [label]);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [label, slug]);

  if (!slug || broken) {
    return (
      <span className={`flex items-center justify-center ${className}`} aria-hidden>
        {fallback(label)}
      </span>
    );
  }

  return (
    <img
      src={simpleIconCdnUrl(slug)}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}
