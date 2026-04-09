"use client";

const GENERAL: string[] = [
  "Geolocation via GeoIP (ip-api); if there is no cache entry, hostname heuristics apply.",
  "Marker clusters and smooth zoom when there are many nodes on the map.",
  "Popups with details when you click a marker: name, status, location, and more.",
];

const MARKER_COLORS: string[] = [
  "Green circle: node online",
  "Red circle: offline",
  "Gray circle: host on the DNS list, not added to the dashboard",
  "Diamond shape with amber ring: Governor node",
];

function CapabilityList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((text, i) => (
        <li
          key={i}
          className="flex gap-2 text-[11px] leading-relaxed text-[var(--text-secondary)]"
        >
          <span className="shrink-0 text-[10px] font-semibold text-[var(--section-icon-cyan-fg)]" aria-hidden>
            ✓
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MapCapabilitiesSection() {
  return (
    <section
      className="mt-8 border-t border-[var(--border-subtle)] pt-8"
      aria-labelledby="map-capabilities-heading"
    >
      <h2
        id="map-capabilities-heading"
        className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]"
      >
        Map capabilities
      </h2>
      <div className="grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-10">
        <CapabilityList items={GENERAL} />
        <CapabilityList items={MARKER_COLORS} />
      </div>
    </section>
  );
}
