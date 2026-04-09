"use client";

const DISCORD_CHANNEL_URL =
  "https://discord.com/channels/969088176322908160/1378117350619873311";
const BADGE_SRC =
  "https://img.shields.io/badge/Tag%20%401F592-Discord-5865F2?style=plastic&logo=discord&logoColor=white";

export default function FooterDiscordSupport() {
  return (
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <p className="max-w-[16rem] text-center text-[11px] font-normal normal-case leading-snug tracking-normal text-[var(--text-muted)] sm:max-w-none sm:text-right">
        Questions, bug reports, or feedback?
      </p>
      <a
        href={DISCORD_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="footer-discord-badge rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
        aria-label="Tag @1F592 on Discord, open channel"
      >
        <img
          src={BADGE_SRC}
          alt="Tag @1F592 on Discord"
          width={107}
          height={16}
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-4 w-auto"
        />
      </a>
    </div>
  );
}
