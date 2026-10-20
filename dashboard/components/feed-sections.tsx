"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ItemRow } from "@/components/item-row";
import {
  buildFeed,
  formatClock,
  formatClockFull,
  startOfBangkokDay,
  type DayGroup,
} from "@/lib/feed";
import { sourceLine } from "@/lib/format";
import {
  fetchAllItems,
  fetchFeedWindow,
  fetchLastRun,
  fetchLatestItemCreatedAt,
  fetchSources,
  PAGE_SIZE,
  type Item,
  type RunCycleResult,
  type Source,
} from "@/lib/items";
import { loadReadIds, markIdRead } from "@/lib/read-items";
import { createClient } from "@/lib/supabase/client";

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

function StatsStrip({
  loading,
  today,
  unread,
  clock,
  clockTitle,
}: {
  loading: boolean;
  today: number;
  unread: number | null;
  clock: string;
  clockTitle?: string;
}) {
  return (
    <p className="feed-stats">
      <span>
        Hôm nay <b>{loading ? "—" : today}</b> tin
      </span>
      <span className="stats-sep" aria-hidden="true">
        ·
      </span>
      <span>
        <b>{loading || unread === null ? "—" : unread}</b> chưa đọc
      </span>
      <span className="stats-sep" aria-hidden="true">
        ·
      </span>
      <span>
        quét lần cuối <span title={clockTitle}>{clock}</span>
      </span>
    </p>
  );
}

function Filters({
  searchInput,
  onSearchInput,
  sourceId,
  onSourceId,
  sources,
}: {
  searchInput: string;
  onSearchInput: (value: string) => void;
  sourceId: string;
  onSourceId: (value: string) => void;
  sources: Source[];
}) {
  return (
    <div className="filters">
      <input
        type="search"
        value={searchInput}
        onChange={(event) => onSearchInput(event.target.value)}
        placeholder="Tìm trong tiêu đề và nội dung…"
        aria-label="Tìm kiếm tin"
      />
      <select
        value={sourceId}
        onChange={(event) => onSourceId(event.target.value)}
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
  );
}

function HotSection({
  items,
  readIds,
  onRead,
}: {
  items: Item[];
  readIds: ReadonlySet<string>;
  onRead: (id: string) => void;
}) {
  return (
    <section>
      <SectionHeader title="Cần xem ngay" count={items.length || undefined} hot />
      {items.length === 0 ? (
        <p className="state">Chưa có tin nóng trong 48h qua</p>
      ) : (
        items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            read={readIds.has(item.id)}
            onRead={onRead}
          />
        ))
      )}
    </section>
  );
}

function TodaySection({
  items,
  total,
  lastScan,
  sourceSummary,
  readIds,
  onRead,
}: {
  items: Item[];
  total: number;
  lastScan: string;
  sourceSummary: string;
  readIds: ReadonlySet<string>;
  onRead: (id: string) => void;
}) {
  const emptyText =
    total === 0
      ? `Hôm nay chưa có tin mới — kỳ quét gần nhất ${lastScan}${
          sourceSummary ? ` (${sourceSummary})` : ""
        }`
      : "Tin hôm nay đang nằm trong Cần xem ngay.";

  return (
    <section>
      <SectionHeader title="Hôm nay" count={items.length || undefined} />
      {items.length === 0 ? (
        <p className="state">{emptyText}</p>
      ) : (
        items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            read={readIds.has(item.id)}
            onRead={onRead}
          />
        ))
      )}
    </section>
  );
}

function DaySection({
  group,
  open,
  onToggle,
  readIds,
  onRead,
}: {
  group: DayGroup;
  open: boolean;
  onToggle: (key: string) => void;
  readIds: ReadonlySet<string>;
  onRead: (id: string) => void;
}) {
  const contentId = `day-${group.key}`;

  return (
    <section className="day-group">
      <button
        type="button"
        className="day-toggle"
        onClick={() => onToggle(group.key)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className={`chevron ${open ? "open" : ""}`} aria-hidden="true">
          ▸
        </span>
        <span>{group.label}</span>
        <span className="count">{group.items.length}</span>
      </button>

      {open ? (
        <div id={contentId}>
          {group.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              read={readIds.has(item.id)}
              onRead={onRead}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SearchSection({
  client,
  q,
  sourceId,
  refreshKey,
  readIds,
  onRead,
}: {
  client: SupabaseClient;
  q: string;
  sourceId: string;
  refreshKey: number;
  readIds: ReadonlySet<string>;
  onRead: (id: string) => void;
}) {
  const key = `${q}|${sourceId}|${refreshKey}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

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
      const rows = await fetchAllItems(client, {
        q,
        sourceId,
        offset: items.length,
      });
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
      <SectionHeader title="Kết quả" count={loading ? undefined : items.length} />

      {loading ? (
        <p className="state">Đang tải…</p>
      ) : error ? (
        <p className="state state-error">Lỗi đọc DB: {error}</p>
      ) : items.length === 0 ? (
        <p className="state">Không có tin nào khớp bộ lọc.</p>
      ) : (
        items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            read={readIds.has(item.id)}
            onRead={onRead}
          />
        ))
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

export function Feed({ refreshKey }: { refreshKey: number }) {
  const client = useMemo(() => createClient(), []);
  const [windowDays, setWindowDays] = useState(7);
  const [feed, setFeed] = useState<Loaded | null>(null);
  const [lastRun, setLastRun] = useState<RunCycleResult | null>(null);
  const [fallbackCreatedAt, setFallbackCreatedAt] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadIds());
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set());

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sources, setSources] = useState<Source[]>([]);

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

  useEffect(() => {
    let active = true;

    fetchLastRun(client)
      .then((result) => {
        if (active) setLastRun(result);
      })
      .catch(() => {
        // Chưa cấp quyền / chưa có kỳ nào — fallback max(created_at).
      });

    fetchLatestItemCreatedAt(client)
      .then((createdAt) => {
        if (active) setFallbackCreatedAt(createdAt);
      })
      .catch(() => {
        // Cùng fallback với items đang có trong cửa sổ feed.
      });

    return () => {
      active = false;
    };
  }, [client, refreshKey]);

  const since = startOfBangkokDay(windowDays);
  const feedKey = `${refreshKey}:${windowDays}`;

  useEffect(() => {
    let active = true;

    fetchFeedWindow(client, since)
      .then((rows) => {
        if (!active) return;
        setFeed({ key: feedKey, items: rows, hasMore: false, error: "" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFeed({
          key: feedKey,
          items: [],
          hasMore: false,
          error: errorMessage(error),
        });
      });

    return () => {
      active = false;
    };
  }, [client, since, feedKey]);

  const loading = feed?.key !== feedKey;
  const items = useMemo(
    () => (feed && feed.key === feedKey ? feed.items : []),
    [feed, feedKey],
  );
  const error = loading ? "" : feed.error;

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const model = useMemo(
    () => buildFeed(items, readSet, windowDays),
    [items, readSet, windowDays],
  );

  const lastScanIso =
    lastRun?.created ?? fallbackCreatedAt ?? model.lastItemCreatedAt;
  const lastScan = formatClock(lastScanIso);
  const lastScanTitle = formatClockFull(lastScanIso);
  const summary = lastRun?.body;
  const sourceSummary = summary
    ? `${summary.sources_ok ?? 0}/${
        (summary.sources_ok ?? 0) + (summary.sources_failed ?? 0)
      } nguồn OK`
    : "";

  const searching = q.length > 0 || sourceId !== "";

  function markRead(id: string) {
    setReadIds((current) =>
      current.includes(id) ? current : markIdRead(current, id),
    );
  }

  function toggleDay(key: string) {
    setOpenDays((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <StatsStrip
        loading={loading || Boolean(error)}
        today={model.todayTotal}
        unread={model.unreadLast7}
        clock={lastScan}
        clockTitle={lastScanTitle}
      />

      <Filters
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        sourceId={sourceId}
        onSourceId={setSourceId}
        sources={sources}
      />

      {searching ? (
        <SearchSection
          client={client}
          q={q}
          sourceId={sourceId}
          refreshKey={refreshKey}
          readIds={readSet}
          onRead={markRead}
        />
      ) : loading ? (
        <p className="state">Đang tải…</p>
      ) : error ? (
        <p className="state state-error">Lỗi đọc DB: {error}</p>
      ) : (
        <>
          <HotSection
            items={model.hot}
            readIds={readSet}
            onRead={markRead}
          />
          <TodaySection
            items={model.today}
            total={model.todayTotal}
            lastScan={lastScan}
            sourceSummary={sourceSummary}
            readIds={readSet}
            onRead={markRead}
          />

          {model.days.length > 0 ? (
            <h2 className="section-title">Những ngày trước</h2>
          ) : null}
          {model.days.map((group) => (
            <DaySection
              key={group.key}
              group={group}
              open={openDays.has(group.key)}
              onToggle={toggleDay}
              readIds={readSet}
              onRead={markRead}
            />
          ))}

          <div className="load-more">
            <button
              type="button"
              className="btn"
              onClick={() => setWindowDays((value) => value + 7)}
            >
              Xem thêm 7 ngày
            </button>
          </div>
        </>
      )}
    </>
  );
}
