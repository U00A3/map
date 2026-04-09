import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Node Map | Bellydash",
  description:
    "Interactive 2D map of the Redbelly node network: dashboard nodes plus the full DNS host list. Refreshes every 30 seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('shared-node-staking-theme');document.documentElement.setAttribute('data-theme',t==='light'||t==='dark'?t:'light');})();`,
          }}
        />
      </head>
      <body>
        <div className="ambient-bg" />
        {children}
        <div className="fixed bottom-4 right-4 z-[100]">
          <ThemeToggle />
        </div>
      </body>
    </html>
  );
}
