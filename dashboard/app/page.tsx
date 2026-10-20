"use client";

import { useState } from "react";
import { AllSection, FixedSection } from "@/components/feed-sections";
import { RequireAuth } from "@/components/require-auth";
import { SiteHeader } from "@/components/site-header";

export default function FeedPage() {
  // Bấm "Chạy ngay" xong thì tải lại cả 3 khối.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <RequireAuth>
      <SiteHeader onRunDone={() => setRefreshKey((value) => value + 1)} />
      <main className="wrap">
        <FixedSection variant="top" refreshKey={refreshKey} />
        <FixedSection variant="today" refreshKey={refreshKey} />
        <AllSection refreshKey={refreshKey} />
      </main>
    </RequireAuth>
  );
}
