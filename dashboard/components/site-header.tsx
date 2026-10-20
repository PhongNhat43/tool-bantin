"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { RunNowButton } from "@/components/run-now-button";
import { ThemeToggle } from "@/components/theme-toggle";

/** Header sticky dùng chung cho các trang private. */
export function SiteHeader({ onRunDone }: { onRunDone?: () => void }) {
  const pathname = usePathname();
  const onSources = pathname.startsWith("/nguon");

  return (
    <header className="site-header">
      <div className="header-row">
        <Link href="/" className="brand">
          Bản tin AI
        </Link>

        <nav className="tabs" aria-label="Khu vực">
          <Link href="/" className={`tab ${onSources ? "" : "active"}`}>
            Feed
          </Link>
          <Link href="/nguon" className={`tab ${onSources ? "active" : ""}`}>
            Nguồn
          </Link>
        </nav>

        <div className="spacer" />

        <ThemeToggle />
        <RunNowButton onDone={onRunDone ?? (() => {})} />
        <LogoutButton />
      </div>
    </header>
  );
}
