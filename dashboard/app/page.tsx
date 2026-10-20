"use client";

import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { RequireAuth } from "@/components/require-auth";
import { createClient } from "@/lib/supabase/client";

type SourceRef = { name: string } | { name: string }[] | null;

type ItemRow = {
  id: string;
  title: string;
  url: string;
  score: number;
  published_at: string | null;
  sources: SourceRef;
};

function sourceName(source: SourceRef): string {
  if (!source) return "không rõ nguồn";
  if (Array.isArray(source)) return source[0]?.name ?? "không rõ nguồn";
  return source.name;
}

function LatestItems() {
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase
      .from("items")
      .select("id, title, url, score, published_at, sources(name)")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(10)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(queryError.message);
          setItems([]);
          return;
        }
        setItems((data ?? []) as unknown as ItemRow[]);
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) return <p className="error">Lỗi đọc DB: {error}</p>;
  if (!items) return <p className="muted">Đang tải tin…</p>;
  if (items.length === 0) return <p className="muted">Chưa có item nào trong DB.</p>;

  return (
    <ol className="item-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className="score">{item.score}</span>
          <div>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
            <p className="meta">
              {sourceName(item.sources)}
              {item.published_at
                ? ` · ${new Date(item.published_at).toLocaleString("vi-VN")}`
                : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <main>
        <header className="topbar">
          <div>
            <h1>Bản tin AI</h1>
            <p className="muted">10 tin mới nhất</p>
          </div>
          <LogoutButton />
        </header>

        <h2>10 tin mới nhất</h2>
        <LatestItems />
      </main>
    </RequireAuth>
  );
}
