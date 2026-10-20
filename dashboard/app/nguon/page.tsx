"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";

/** Placeholder — trang Nguồn đầy đủ làm ở task 3.3. */
export default function SourcesPage() {
  return (
    <RequireAuth>
      <SiteHeader />
      <main className="wrap">
        <h1 className="page-title">Nguồn</h1>
        <p className="state">
          Trang quản lý nguồn (danh sách, bật/tắt, thêm nguồn mới) sẽ làm ở task 3.3.
        </p>
        <p>
          <Link href="/" className="back-link">
            ← Về Feed
          </Link>
        </p>
      </main>
    </RequireAuth>
  );
}
