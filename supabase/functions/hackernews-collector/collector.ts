// Hacker News collector — phần LOGIC (Supabase Edge Function hackernews-collector).
//
// File này KHÔNG có side-effect khi import: không gọi Deno.serve, không đọc env.
// Nhờ vậy test import trực tiếp được mà không khởi động server trên cổng 8000
// (xem DECISIONS #32 và bài học #33).
//
// Luồng: đọc checkpoint từ sources -> fetch mỗi query -> normalize -> upsert items.
//
// Entrypoint (Deno.serve + cờ --once) nằm ở ./index.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { normalize } from "../_shared/normalize.ts";
import type { ItemInput } from "../_shared/types.ts";

/** Lỗi mạng được thử lại tối đa 3 lần (AGENTS.md mục 5). */
const MAX_RETRIES = 3;

/** Số story lấy về cho mỗi query. */
const HITS_PER_PAGE = 30;

/** Khi chưa có checkpoint, chỉ lấy trong 7 ngày gần nhất. */
const DEFAULT_LOOKBACK_DAYS = 7;

const HN_API = "https://hn.algolia.com/api/v1/search";
const HN_ITEM_URL = "https://news.ycombinator.com/item?id=";
const LOG = "[hackernews-collector]";

/** Cấu hình lấy từ `sources.config` — không hardcode trong code. */
interface HackerNewsSourceConfig {
  /** Danh sách câu truy vấn, mỗi câu gọi API 1 lần. */
  queries?: string[];
  /** Ngưỡng điểm tối thiểu. */
  min_points?: number;
  /** Checkpoint lần chạy trước (ISO). */
  last_seen?: string;
  /** Giữ nguyên mọi field khác khi ghi đè checkpoint. */
  [key: string]: unknown;
}

interface HnHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  created_at_i: number;
  points: number | null;
}

interface HnSearchResponse {
  nbHits: number;
  hits: HnHit[];
}

function log(...args: unknown[]): void {
  console.log(LOG, ...args);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error(
      "Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong env",
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Gọi Algolia HN API, retry tối đa MAX_RETRIES lần với backoff cho lỗi mạng/5xx.
 * Trả về ngay khi gặp 429 để caller dừng êm.
 */
async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const waitMs = 500 * 2 ** (attempt - 1);
      log(
        `lỗi mạng, thử lại ${attempt}/${MAX_RETRIES} sau ${waitMs}ms — ${String(lastError)}`,
      );
      await sleep(waitMs);
    }

    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (err) {
      lastError = err;
      continue;
    }

    // Bị giới hạn tần suất: không thử lại, để caller dừng êm.
    if (res.status === 429) return res;

    if (res.status >= 500) {
      lastError = new Error(`HTTP ${res.status}`);
      continue;
    }

    return res;
  }

  throw new Error(
    `HN API không phản hồi sau ${MAX_RETRIES + 1} lần thử: ${String(lastError)}`,
  );
}

/** Unix timestamp (giây) của checkpoint; chưa có thì lùi về 7 ngày trước. */
function resolveLastSeenUnix(lastSeen: string | undefined): number {
  if (typeof lastSeen === "string" && lastSeen.trim() !== "") {
    const parsed = new Date(lastSeen);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
    log(`cảnh báo: last_seen không hợp lệ ("${lastSeen}") — dùng mốc mặc định`);
  }
  return Math.floor(Date.now() / 1000) - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60;
}

function buildSearchUrl(query: string, minPoints: number, lastSeenUnix: number): string {
  const url = new URL(HN_API);
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set(
    "numericFilters",
    `points>${minPoints},created_at_i>${lastSeenUnix}`,
  );
  url.searchParams.set("hitsPerPage", String(HITS_PER_PAGE));
  return url.toString();
}

/** Story thô -> ItemInput qua _shared/normalize (không tự xử lý tay). */
function mapHitToItem(hit: HnHit, sourceId: string): ItemInput {
  const fallbackUrl = `${HN_ITEM_URL}${hit.objectID}`;

  return normalize({
    source_id: sourceId,
    external_id: String(hit.objectID),
    title: hit.title ?? `HN story ${hit.objectID}`,
    // Ask HN / Show HN không có url ngoài -> trỏ về trang thảo luận trên HN.
    url: hit.url && hit.url.trim() !== "" ? hit.url : fallbackUrl,
    author: hit.author ?? undefined,
    published_at: new Date(hit.created_at_i * 1000),
    engagement: { points: hit.points ?? 0 },
  });
}

/** Ghi checkpoint `last_seen`, giữ nguyên các field config khác. */
async function saveCheckpoint(
  supabase: ReturnType<typeof createSupabaseClient>,
  sourceId: string,
  config: HackerNewsSourceConfig,
  lastSeen: string,
): Promise<void> {
  const nextConfig: HackerNewsSourceConfig = { ...config, last_seen: lastSeen };
  const { error } = await supabase
    .from("sources")
    .update({ config: nextConfig })
    .eq("id", sourceId);

  if (error) {
    throw new Error(`Cập nhật checkpoint thất bại: ${error.message}`);
  }
}

export async function runCollector(): Promise<void> {
  const supabase = createSupabaseClient();

  // 1. Đọc nguồn hackernews đang bật.
  const { data: sources, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, config, enabled")
    .eq("type", "hackernews")
    .eq("enabled", true)
    .limit(1);

  if (sourceError) {
    throw new Error(`Đọc bảng sources thất bại: ${sourceError.message}`);
  }
  if (!sources || sources.length === 0) {
    log("không tìm thấy source type=hackernews đang bật — dừng");
    return;
  }

  const source = sources[0];
  const config = (source.config ?? {}) as HackerNewsSourceConfig;

  const queries = config.queries;
  if (!Array.isArray(queries) || queries.length === 0) {
    throw new Error('sources.config thiếu mảng "queries" hợp lệ');
  }
  const minPoints = Number(config.min_points ?? 30);
  const lastSeenUnix = resolveLastSeenUnix(config.last_seen);

  log(`source="${source.name}" id=${source.id}`);
  log(
    `config: queries=${JSON.stringify(queries)} min_points=${minPoints} last_seen=${config.last_seen ?? "(chưa có)"} -> created_at_i>${lastSeenUnix}`,
  );

  // 2. Gọi API lần lượt cho từng query, gom hit.
  const hitsById = new Map<string, HnHit>();
  let rawHitCount = 0;

  for (const query of queries) {
    const searchUrl = buildSearchUrl(query, minPoints, lastSeenUnix);
    log(`GET ${searchUrl}`);

    const res = await fetchWithRetry(searchUrl);

    if (res.status === 429) {
      // Không ghi checkpoint: lần sau vẫn quét lại đúng khoảng này, tránh mất tin.
      log("HN API trả 429, dừng êm (giữ nguyên checkpoint) — không throw");
      return;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HN API lỗi HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const payload = (await res.json()) as HnSearchResponse;
    const hits = payload.hits ?? [];
    rawHitCount += hits.length;
    log(`query "${query}": ${hits.length} story (nbHits=${payload.nbHits})`);

    for (const hit of hits) {
      if (!hit.objectID) continue;
      // Query khác nhau có thể trả cùng 1 story -> gộp trước khi upsert.
      if (!hitsById.has(hit.objectID)) hitsById.set(hit.objectID, hit);
    }
  }

  const uniqueHits = [...hitsById.values()];
  log(
    `fetch: ${rawHitCount} story thô | ${uniqueHits.length} story duy nhất sau khi gộp query`,
  );

  if (uniqueHits.length === 0) {
    log("upsert mới: 0 | bỏ qua do trùng: 0");
    const now = new Date().toISOString();
    await saveCheckpoint(supabase, source.id, config, now);
    log(`checkpoint last_seen -> ${now}`);
    return;
  }

  // 3. Normalize.
  const rows = uniqueHits.map((hit) => mapHitToItem(hit, source.id));

  // 4. Upsert, bỏ qua trùng. ignoreDuplicates => RETURNING chỉ trả row thật sự chèn.
  const { data: inserted, error: upsertError } = await supabase
    .from("items")
    .upsert(rows, {
      onConflict: "source_id,external_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (upsertError) {
    throw new Error(`Upsert items thất bại: ${upsertError.message}`);
  }

  const newCount = inserted?.length ?? 0;
  log(`upsert mới: ${newCount} | bỏ qua do trùng: ${rows.length - newCount}`);

  // 5. Ghi checkpoint.
  const now = new Date().toISOString();
  await saveCheckpoint(supabase, source.id, config, now);
  log(`checkpoint last_seen -> ${now}`);
}
