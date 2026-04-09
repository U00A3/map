/**
 * CTA styled like the Staking Panel on the main dashboard (stxbut.md section 4), linking to the main app.
 */
export default function DashboardCtaLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="staking-panel-btn inline-flex w-full items-center justify-center gap-2.5 sm:w-auto"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 3h-8l-2 4h12z" />
        <circle cx="12" cy="14" r="2" />
      </svg>
      <span>Dashboard</span>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-40"
        aria-hidden
      >
        <path d="M7 17L17 7M17 7H8M17 7v9" />
      </svg>
    </a>
  );
}
