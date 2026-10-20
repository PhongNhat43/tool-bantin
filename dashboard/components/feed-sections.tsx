"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemRow } from "@/components/item-row";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAllItems,
  fetchSources,
  fetchTodayItems,
  fetchTopItems,
  PAGE_SIZE,
  type Item,
  type Source,
} from "@/lib/items";
import { sourceLine } from "@/lib/format";

/**
 * Ghi chú: loading được SUY RA từ "dữ liệu đang có thuộc request nào" thay vì
 * setState("loading") đồng bộ trong effect (React 19 không khuyến khích).
 */
type Loaded = { key: string; items: Item[]; hasMore: boolean; error: string };

function SectionHeader({
  title,
  count,
  hot,
}: {
  title: string;
  count?: number;
  hot?: boolean;
}) {
  return (
    <h2 className={`section-title ${hot ? "hot" : ""}`}>
      {title}
      {typeof count === "number" ? <span className="count">{count}</span> : null}
    </h2>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Khối "Cần xem ngay" (score >= 70) hoặc "Hôm nay" (40–69 trong 24h). */
export function FixedSection({
  variant,
  refreshKey,
}: {
  variant: "top" | "today";
  refreshKey: number;
}) {
  const client = useMemo(() => createClient(), []);
  const key = `${variant}:${refreshKey}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    const request =
      variant === "top" ? fetchTopItems(client) : fetchTodayItems(client);

    request
      .then((rows) => {
        if (!active) return;
        setLoaded({ key, items: rows, hasMore: false, error: "" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoaded({ key, items: [], hasMore: false, error: errorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [client, variant, key]);

  const loading = loaded?.key !== key;
  const items = loading ? [] : loaded.items;
  const error = loading ? "" : loaded.error;

  const isTop = variant === "top";
  const title = isTop ? "Cần xem ngay" : "Hôm nay";
  const emptyText = isTop
    ? "Chưa có tin nào đạt 70 điểm."
    : "Chưa có tin 40–69 điểm trong 24 giờ qua.";

  return (
    <section>
      <SectionHeader
        title={title}
        count={loading ? undefined : items.length}
        hot={isTop}
      />

      {loading ? (
        <p className="state">Đang tải…</p>
      ) : error ? (
        <p className="state state-error">Lỗi đọc DB: {error}</p>
      ) : items.length === 0 ? (
        <p className="state">{emptyText}</p>
      ) : (
        items.map((item) => <ItemRow key={item.id} item={item} />)
      )}
    </section>
  );
}

/** Khối "Tất cả": tìm kiếm (title + content), lọc nguồn, "Tải thêm" 50/lần. */
export function AllSection({ refreshKey }: { refreshKey: number }) {
  const client = useMemo(() => createClient(), []);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  // Gõ tới đâu tìm tới đó, chờ 350ms cho khỏi spam request.
  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    fetchSources(client)
      .then((rows) => {
        if (active) setSources(rows);
      })
      .catch(() => {
        // Dropdown lỗi không chặn danh sách tin.
      });
    return () => {
      active = false;
    };
  }, [client]);

  const key = `${q}|${sourceId}|${refreshKey}`;

  useEffect(() => {
    let active = true;

    fetchAllItems(client, { q, sourceId, offset: 0 })
      .then((rows) => {
        if (!active) return;
        setLoaded({
          key,
          items: rows,
          hasMore: rows.length === PAGE_SIZE,
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoaded({ key, items: [], hasMore: false, error: errorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [client, q, sourceId, key]);

  const loading = loaded?.key !== key;
  const items = loading ? [] : loaded.items;
  const hasMore = loading ? false : loaded.hasMore;
  const error = loading ? "" : loaded.error;

  async function loadMore() {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    setMoreError("");

    try {
      const rows = await fetchAllItems(client, { q, sourceId, offset: items.length });
      setLoaded((current) => {
        if (!current || current.key !== key) return current;
        return {
          key: current.key,
          items: [...current.items, ...rows],
          hasMore: rows.length === PAGE_SIZE,
          error: "",
        };
      });
    } catch (error: unknown) {
      setMoreError(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section>
      <SectionHeader title="Tất cả" count={loading ? undefined : items.length} />

      <div className="filters">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Tìm trong tiêu đề và nội dung…"
          aria-label="Tìm kiếm tin"
        />
        <select
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
          aria-label="Lọc theo nguồn"
        >
          <option value="">Tất cả nguồn</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {sourceLine(source.name, source.type)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="state">Đang tải…</p>
      ) : error ? (
        <p className="state state-error">Lỗi đọc DB: {error}</p>
      ) : items.length === 0 ? (
        <p className="state">Không có tin nào khớp bộ lọc.</p>
      ) : (
        items.map((item) => <ItemRow key={item.id} item={item} />)
      )}

      {moreError ? (
        <p className="state state-error">Lỗi tải thêm: {moreError}</p>
      ) : null}

      {hasMore ? (
        <div className="load-more">
          <button
            type="button"
            className="btn"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Đang tải…" : "Tải thêm"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
