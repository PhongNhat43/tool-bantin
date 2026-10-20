"use client";

import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";
import { SourcesManager } from "@/components/sources-manager";

/** Trang Nguồn: danh sách + bật/tắt + thêm nguồn mới (task 3.3). */
export default function SourcesPage() {
  return (
    <RequireAuth>
      <SiteHeader />
      <main className="wrap">
        <SourcesManager />
      </main>
    </RequireAuth>
  );
}
