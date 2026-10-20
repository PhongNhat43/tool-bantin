// run-cycle — phần LOGIC (Supabase Edge Function).
//
// File này KHÔNG có side-effect khi import: không gọi Deno.serve, không đọc env,
// không tạo client. Entrypoint (Deno.serve + cờ --once) nằm ở ./index.ts.
//
// Mỗi kỳ quét:
//   1. Đọc sources enabled=true, chạy collector theo type (facebook bỏ qua —
//      nguồn bị động, Merlin bắn qua ingest-facebook). Mỗi source 1 try/catch.
//   2. Chấm điểm tối đa 200 item chưa chấm (score=0 và chưa có score_breakdown),
//      kèm cross-source 24h (trùng URL chuẩn hóa hoặc title chuẩn hóa).
//   3. Ghi score + breakdown vào engagement (không để NULL — bài học #38).
//   4. Notify: tin <48h tuổi mới báo; notify_now hoặc score>=70 -> sendInstant,
//      40<=score<70 -> gom 1 digest cuối kỳ.
//
// Trả summary để pg_cron/curl thấy kết quả. Một source chết không giết cả kỳ.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { collectSource as collectGithub } from "../github-collector/collector.ts";
import { collectSource as collectHackerNews } from "../hackernews-collector/collector.ts";
import { normalizeUrl } from "../_shared/normalize.ts";
import {
  sendDigest,
  sendInstant,
  type NotifyItem,
} from "../_shared/notify.ts";
import { collectSource as collectRss } from "../rss-collector/collector.ts";
import { scoreItem, type SourceType } from "../_shared/scoring.ts";

const LOG = "[run-cycle]";

/** Số item chấm điểm tối đa mỗi kỳ (tránh 1 kỳ quá dài). */
const MAX_ITEMS_PER_CYCLE = 200;

/** Cửa sổ cross-source: tin khác nguồn trong 24h. */
const CROSS_SOURCE_WINDOW_HOURS = 24;

/** Chỉ notify tin còn mới trong 48h; tin cũ hơn chỉ lưu DB. */
const NOTIFY_MAX_AGE_HOURS = 48;

/** Ngưỡng điểm báo ngay / vào digest (AGENTS.md mục 6). */
const INSTANT_SCORE = 70;
const DIGEST_SCORE = 40;

const SOURCE_TYPES: readonly SourceType[] = [
  "facebook",
  "reddit",
  "github",
  "hackernews",
  "rss",
];

export interface CycleSummary {
  sources_ok: number;
  sources_failed: number;
  scored: number;
  /** Số tin nhắn instant đã gửi thành công (không tính tin bị chống trùng). */
  notified_instant: number;
  /** 1 nếu có gửi digest kỳ này, 0 nếu không. */
  notified_digest: number;
}

interface SourceRow {
  id: string;
  name: string;
  type: string;
  config: unknown;
}

interface PendingItemRow {
  id: string;
  title: string;
  content: string | null;
  url: string;
  published_at: string | null;
  engagement: Record<string, unknown> | null;
  source_id: string;
  sources: { name?: string; type?: string } | null;
}

interface RecentItemRow {
  id: string;
  source_id: string;
  url: string;
  title: string;
}

function log(...args: unknown[]): void {
  console.log(LOG, ...args);
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" &&
    SOURCE_TYPES.includes(value as SourceType);
}

/** Tuổi tin (giờ); ngày tương lai -> 0; thiếu/không parse được -> null. */
function ageHours(publishedAt: string | null, now: Date): number | null {
  if (!publishedAt) return null;
  const ms = Date.parse(publishedAt);
  if (Number.isNaN(ms)) return null;
  const hours = (now.getTime() - ms) / 3_600_000;
  return hours < 0 ? 0 : hours;
}

/**
 * Khóa so khớp title: lowercase, bỏ ký tự đặc biệt (giữ chữ/số Unicode),
 * gộp khoảng trắng. Rỗng -> null (không dùng để so khớp).
 */
export function normalizeTitleKey(title: string): string | null {
  const key = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  return key === "" ? null : key;
}

/** Khóa URL đã chuẩn hóa; URL hỏng -> null. */
function urlKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return normalizeUrl(url);
  } catch {
    return null;
  }
}

interface CrossSourceIndex {
  byUrl: Map<string, Set<string>>;
  byTitle: Map<string, Set<string>>;
}

function addSource(
  index: Map<string, Set<string>>,
  key: string | null,
  sourceId: string,
): void {
  if (key === null) return;
  const sources = index.get(key) ?? new Set<string>();
  sources.add(sourceId);
  index.set(key, sources);
}

/** Gom tin 24h qua thành index URL/title -> tập source_id. */
export function buildCrossSourceIndex(
  rows: readonly RecentItemRow[],
): CrossSourceIndex {
  const byUrl = new Map<string, Set<string>>();
  const byTitle = new Map<string, Set<string>>();

  for (const row of rows) {
    addSource(byUrl, urlKey(row.url), row.source_id);
    addSource(byTitle, normalizeTitleKey(row.title), row.source_id);
  }

  return { byUrl, byTitle };
}

/** Có tin ở source KHÁC trùng URL hoặc title không. */
export function hasCrossSource(
  index: CrossSourceIndex,
  item: { source_id: string; url: string; title: string },
): boolean {
  const otherSource = (sources: Set<string> | undefined): boolean => {
    if (!sources) return false;
    for (const sourceId of sources) {
      if (sourceId !== item.source_id) return true;
    }
    return false;
  };

  return otherSource(index.byUrl.get(urlKey(item.url) ?? "")) ||
    otherSource(index.byTitle.get(normalizeTitleKey(item.title) ?? ""));
}

/** Map type -> hàm collector. `facebook` cố tình không có (nguồn bị động). */
type Collector = (
  supabase: SupabaseClient,
  source: SourceRow,
) => Promise<void>;

const COLLECTORS: Record<string, Collector> = {
  github: collectGithub,
  hackernews: collectHackerNews,
  rss: collectRss,
};

function toNotifyItem(
  row: PendingItemRow,
  score: number,
  notifyReason?: string,
): NotifyItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source_name: row.sources?.name ?? row.sources?.type ?? "?",
    score,
    notify_reason: notifyReason,
  };
}

/** Chạy 1 kỳ: collect -> score -> notify. Throw chỉ khi lỗi DB không cứu được. */
export async function runCycle(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<CycleSummary> {
  const summary: CycleSummary = {
    sources_ok: 0,
    sources_failed: 0,
    scored: 0,
    notified_instant: 0,
    notified_digest: 0,
  };

  log(`bắt đầu kỳ quét ${now.toISOString()}`);

  // -------------------------------------------------------------------------
  // 1. Collectors — mỗi source 1 try/catch.
  // -------------------------------------------------------------------------
  const { data: sourceData, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, type, config")
    .eq("enabled", true)
    .order("name");

  if (sourceError) {
    throw new Error(`Đọc bảng sources thất bại: ${sourceError.message}`);
  }

  const sources = (sourceData ?? []) as unknown as SourceRow[];
  log(`sources enabled: ${sources.length}`);

  for (const source of sources) {
    if (source.type === "facebook") {
      log(
        `bỏ qua source "${source.name}" (facebook — nguồn bị động, Merlin bắn qua ingest-facebook)`,
      );
      continue;
    }

    const collector = COLLECTORS[source.type];
    if (!collector) {
      log(
        `bỏ qua source "${source.name}" — type="${source.type}" chưa có collector`,
      );
      continue;
    }

    log(`chạy collector type="${source.type}" cho source "${source.name}"`);
    try {
      await collector(supabase, source);
      summary.sources_ok++;
      log(`source "${source.name}" (${source.type}) — ok`);
    } catch (error) {
      summary.sources_failed++;
      console.error(
        LOG,
        `source "${source.name}" (${source.type}) lỗi:`,
        error,
      );
    }
  }

  log(
    `collectors xong: ${summary.sources_ok} ok | ${summary.sources_failed} lỗi`,
  );

  // -------------------------------------------------------------------------
  // 2. Chấm điểm — tối đa 200 item chưa có score_breakdown.
  // -------------------------------------------------------------------------
  const since24h = new Date(
    now.getTime() - CROSS_SOURCE_WINDOW_HOURS * 3_600_000,
  ).toISOString();

  const { data: recentData, error: recentError } = await supabase
    .from("items")
    .select("id, source_id, url, title")
    .gte("published_at", since24h)
    .limit(2000);

  if (recentError) {
    throw new Error(
      `Đọc items 24h cho cross-source thất bại: ${recentError.message}`,
    );
  }

  const crossIndex = buildCrossSourceIndex(
    (recentData ?? []) as unknown as RecentItemRow[],
  );

  const { data: pendingData, error: pendingError } = await supabase
    .from("items")
    .select(
      "id, title, content, url, published_at, engagement, source_id, sources(name, type)",
    )
    .eq("score", 0)
    .is("engagement->>score_breakdown", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(MAX_ITEMS_PER_CYCLE);

  if (pendingError) {
    throw new Error(
      `Đọc items chưa chấm điểm thất bại: ${pendingError.message}`,
    );
  }

  const pending = (pendingData ?? []) as unknown as PendingItemRow[];
  log(
    `chấm điểm: ${pending.length} item chờ (tối đa ${MAX_ITEMS_PER_CYCLE}/kỳ) | cross-source index: ${crossIndex.byUrl.size} URL, ${crossIndex.byTitle.size} title`,
  );

  const instantQueue: NotifyItem[] = [];
  const digestQueue: NotifyItem[] = [];
  let crossCount = 0;
  let skippedOldNotify = 0;

  for (const item of pending) {
    const sourceType = item.sources?.type;
    if (!isSourceType(sourceType)) {
      log(
        `bỏ qua item ${item.id} — source type không hợp lệ: ${String(sourceType)}`,
      );
      continue;
    }

    const crossSource = hasCrossSource(crossIndex, {
      source_id: item.source_id,
      url: item.url,
      title: item.title,
    });
    if (crossSource) crossCount++;

    const result = scoreItem({
      title: item.title,
      content: item.content ?? undefined,
      url: item.url,
      // Item thiếu ngày: coi như rất cũ để recency = 0 (không đoán là mới).
      published_at: item.published_at ?? new Date(0).toISOString(),
      source_type: sourceType,
      engagement: (item.engagement ?? {}) as Record<string, number>,
      cross_source: crossSource,
    });

    // Gộp vào engagement hiện có; không bao giờ gửi NULL cho jsonb (#38).
    const engagement: Record<string, unknown> = {
      ...(item.engagement ?? {}),
      score_breakdown: result.breakdown,
    };

    const { error: updateError } = await supabase
      .from("items")
      .update({ score: result.score, engagement })
      .eq("id", item.id);

    if (updateError) {
      console.error(
        LOG,
        `ghi điểm item ${item.id} lỗi (để kỳ sau chấm lại):`,
        updateError.message,
      );
      continue;
    }

    summary.scored++;

    // -----------------------------------------------------------------------
    // 3. Notify — chỉ tin có published_at trong 48h qua.
    // -----------------------------------------------------------------------
    const age = ageHours(item.published_at, now);
    if (age === null || age > NOTIFY_MAX_AGE_HOURS) {
      skippedOldNotify++;
      continue;
    }

    const notifyItem = toNotifyItem(
      item,
      result.score,
      result.notify_reason,
    );

    if (result.notify_now || result.score >= INSTANT_SCORE) {
      instantQueue.push(notifyItem);
    } else if (result.score >= DIGEST_SCORE) {
      digestQueue.push(notifyItem);
    }
    // score < 40: chỉ lưu DB.
  }

  log(
    `ghi điểm: ${summary.scored}/${pending.length} | cross-source: ${crossCount} | không notify do >48h/thiếu ngày: ${skippedOldNotify} | instant: ${instantQueue.length} | digest: ${digestQueue.length}`,
  );

  // -------------------------------------------------------------------------
  // 4. Gửi notify — lỗi 1 tin không chặn tin khác.
  // -------------------------------------------------------------------------
  for (const item of instantQueue) {
    try {
      const outcome = await sendInstant(supabase, item);
      if (outcome === "sent") summary.notified_instant++;
      log(`instant item ${item.id}: ${outcome}`);
    } catch (error) {
      console.error(LOG, `gửi instant item ${item.id} lỗi:`, error);
    }
  }

  if (digestQueue.length > 0) {
    try {
      const outcome = await sendDigest(supabase, digestQueue);
      if (outcome === "sent") summary.notified_digest = 1;
      log(`digest ${digestQueue.length} tin: ${outcome}`);
    } catch (error) {
      console.error(LOG, "gửi digest lỗi:", error);
    }
  } else {
    log("không có tin 40–69 điểm — không gửi digest");
  }

  log(`tổng kết: ${JSON.stringify(summary)}`);
  return summary;
}
