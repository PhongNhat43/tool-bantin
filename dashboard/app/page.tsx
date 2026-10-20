"use client";

import { useState } from "react";
import { Feed } from "@/components/feed-sections";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";

export default function FeedPage() {
  // Bấm "Chạy ngay" xong thì tải lại feed + kỳ quét mới nhất.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <RequireAuth>
      <SiteHeader onRunDone={() => setRefreshKey((value) => value + 1)} />
      <main className="wrap">
        <Feed refreshKey={refreshKey} />
      </main>
    </RequireAuth>
  );
}
