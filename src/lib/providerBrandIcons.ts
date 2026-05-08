/**
 * Brand logos via Simple Icons (MIT) served from jsDelivr (SVG files).
 * @see https://simpleicons.org/
 *
 * SVG URL: `https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/{slug}.svg`
 * (cdn.simpleicons.org often blocks server-side fetch; jsDelivr works in browsers.)
 *
 * ip-api returns free-form ISP/org strings; we match common hosting patterns to a slug.
 * Unmatched labels → no icon (caller uses letter / globe fallback).
 */

/** Ordered: first match wins (more specific patterns first). */
const BRAND_RULES: { test: RegExp; slug: string }[] = [
  { test: /amazon\s+technologies|amazon(?:\.com)?\s+inc|amazon\s+web\s+services|\bAWS\b|amazonaws/i, slug: "amazonaws" },
  { test: /google\s+cloud|\bGCP\b/i, slug: "googlecloud" },
  { test: /google\s+llc/i, slug: "google" },
  { test: /microsoft\s+azure|\bAzure\b/i, slug: "microsoftazure" },
  { test: /oracle\s+cloud|oracle\s+corporation/i, slug: "oracle" },
  { test: /ibm\s+cloud/i, slug: "ibm" },
  { test: /cloudflare/i, slug: "cloudflare" },
  { test: /akamai|linode/i, slug: "akamai" },
  { test: /digitalocean/i, slug: "digitalocean" },
  { test: /hetzner/i, slug: "hetzner" },
  { test: /\bOVH\b|ovh\s+cloud|soyoustart|kimsufi/i, slug: "ovh" },
  { test: /scaleway|online\.net/i, slug: "scaleway" },
  { test: /vultr|choopa/i, slug: "vultr" },
  { test: /ionos|1&1/i, slug: "ionos" },
  { test: /netcup/i, slug: "netcup" },
  { test: /equinix/i, slug: "equinixmetal" },
  { test: /fastly/i, slug: "fastly" },
  { test: /alibaba\s+cloud/i, slug: "alibabacloud" },
  { test: /hostinger/i, slug: "hostinger" },
  { test: /namecheap/i, slug: "namecheap" },
  { test: /godaddy/i, slug: "godaddy" },
  { test: /verizon/i, slug: "verizon" },
  { test: /orange\s*\(|orange\s+s\.a/i, slug: "orange" },
  { test: /vodafone/i, slug: "vodafone" },
];

/**
 * Simple Icons slug if `label` matches a known provider pattern.
 */
export function providerBrandSlug(label: string): string | null {
  const t = label.trim();
  if (!t || t === "Unknown") return null;
  for (const { test, slug } of BRAND_RULES) {
    if (test.test(t)) return slug;
  }
  return null;
}

const SIMPLE_ICONS_PKG = "simple-icons@11.14.0";

/**
 * CDN URL for a Simple Icons slug (raw SVG). `color` reserved for future theming.
 */
export function simpleIconCdnUrl(slug: string, _color?: string): string {
  const s = slug.trim().toLowerCase();
  if (!s) return "";
  return `https://cdn.jsdelivr.net/npm/${SIMPLE_ICONS_PKG}/icons/${s}.svg`;
}
