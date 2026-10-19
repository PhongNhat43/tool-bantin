// ingest-facebook — phần LOGIC (Supabase Edge Function).
//
// Đây là endpoint NHẬN dữ liệu (push), KHÔNG phải collector đi fetch: Merlin quét
// 3 group Facebook bằng lịch riêng rồi POST JSON vào đây (xem ARCHITECTURE.md).
//
// File này KHÔNG có side-effect khi import: không gọi Deno.serve, không tạo client
// ở top-level (client tạo bên trong hàm) -> test import trực tiếp được, không dính
// bẫy cổng 8000 (xem DECISIONS #32/#34).
//
// Luồng: parse body (1 bài | mảng | {posts|items|data:[...]}) -> khớp group_id với
//        source type=facebook -> normalize -> upsert (ignoreDuplicates) -> thống kê.
//
// KHÁC các collector: đây là push nên KHÔNG có checkpoint `last_seen`; chống trùng
// do UNIQUE(source_id, external_id) lo, đúng như AGENTS.md mục 2.
//
// Entrypoint (Deno.serve + cờ --once) nằm ở ./index.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { normalize } from "../_shared/normalize.ts";
import type { ItemInput } from "../_shared/types.ts";

const LOG = "[ingest-facebook]";

/** Cắt nội dung về 1000 ký tự (giống rss-collector, xem DECISIONS #26). */
const MAX_CONTENT_CHARS = 1000;
/** Cắt tiêu đề suy diễn từ text về 120 ký tự. */
const MAX_TITLE_CHARS = 120;
/** Chia lô khi upsert để 1 request không quá lớn. */
const UPSERT_CHUNK = 200;

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

// ---------------------------------------------------------------------------
// Alias field: Merlin có thể đặt tên khác — chấp nhận nhiều biến thể cho chắc.
// Thứ tự trong mảng là thứ tự ưu tiên (tên chuẩn đứng trước).
// ---------------------------------------------------------------------------
const GROUP_KEYS = [
  "group_id",
  "groupId",
  "groupID",
  "group",
  "source_group_id",
  "sourceGroupId",
];
const POST_ID_KEYS = [
  "post_id",
  "postId",
  "postID",
  "external_id",
  "externalId",
  "object_id",
  "objectId",
  "fb_post_id",
  "id",
];
const TEXT_KEYS = [
  "text",
  "content",
  "message",
  "body",
  "description",
  "post_text",
  "postText",
  "caption",
];
const URL_KEYS = [
  "url",
  "permalink",
  "permalink_url",
  "link",
  "post_url",
  "postUrl",
  "fb_url",
  "share_url",
];
const AUTHOR_KEYS = [
  "author",
  "author_name",
  "authorName",
  "from",
  "user",
  "poster",
  "user_name",
];
const TIME_KEYS = [
  "created_at",
  "createdAt",
  "created_time",
  "createdTime",
  "published_at",
  "publishedAt",
  "timestamp",
  "time",
  "date",
];
const REACTION_KEYS = [
  "reactions",
  "reacts",
  "reaction_count",
  "reactionCount",
  "reactions_count",
  "like_count",
  "likes",
  "likes_count",
];
const COMMENT_KEYS = [
  "comments",
  "comment_count",
  "commentCount",
  "comments_count",
  "num_comments",
];
const SHARE_KEYS = ["shares", "share_count", "shareCount", "shares_count"];

interface GroupInfo {
  id: string;
  name: string;
  group_id: string;
}

/** Row `sources` type=facebook (khai tường minh vì supabase-js không có generated types). */
interface FacebookSourceRow {
  id: string;
  name: string;
  config: Record<string, unknown> | null;
}

interface SkippedPost {
  group_id: string | null;
  post_id: string | null;
  reason: string;
}

interface GroupStat {
  group_id: string;
  name: string;
  fetched: number;
  inserted: number;
  deduped: number;
}

export interface IngestResult {
  ok: boolean;
  /** Số bài thô nhận trong body. */
  received: number;
  /** Số bài hợp lệ đã đưa vào normalize. */
  fetched: number;
  inserted: number;
  deduped: number;
  skipped: number;
  skipped_details: SkippedPost[];
  /** group_id (hoặc giá trị group) không khớp source nào đang bật. */
  unknown_groups: string[];
  groups: GroupStat[];
}

function log(...args: unknown[]): void {
  console.log(LOG, ...args);
}

export function createSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error(
      "Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong env",
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Xác thực secret (so sánh kiểu không rò rỉ thời gian).
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** So secret người gọi với INGEST_SECRET. Thiếu 1 trong 2 phía -> false. */
export function checkSecret(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected || !provided) return false;
  return timingSafeEqual(provided, expected);
}

// ---------------------------------------------------------------------------
// Trích xuất field (chịu được alias + nhiều kiểu dữ liệu).
// ---------------------------------------------------------------------------

/** Lấy giá trị đầu tiên không rỗng theo danh sách tên field. */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** Ép về chuỗi đã trim; object có `.name` (vd "from": {name}) thì lấy name. */
function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const name = (value as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim() !== "") return name.trim();
  }
  return undefined;
}

/** Ép về số nguyên >= 0; không hợp lệ -> undefined. */
function toCount(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

/** Ép về ISO string; nhận ISO string hoặc số (unix giây/ms); sai -> undefined. */
function toIso(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value; // < 1e12 => đang là giây
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Tiêu đề suy diễn = dòng đầu không rỗng của text (bài FB không có title riêng). */
function deriveTitle(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find((line) => line !== "");
  const title = firstLine ?? text.replace(/\s+/g, " ").trim();
  return truncate(title, MAX_TITLE_CHARS);
}

/** URL permalink; thiếu thì dựng từ group_id + post_id; đường dẫn tương đối thì ghép host. */
function resolveUrl(raw: unknown, groupId: string, postId: string): string {
  if (typeof raw === "string" && raw.trim() !== "") {
    const trimmed = raw.trim();
    return trimmed.startsWith("/")
      ? `https://www.facebook.com${trimmed}`
      : trimmed;
  }
  return `https://www.facebook.com/groups/${groupId}/posts/${postId}`;
}

interface RawPost {
  groupKey?: string;
  postId?: string;
  text?: string;
  url?: string;
  author?: string;
  publishedAt?: string;
  engagement: Record<string, number>;
}

function extractPost(raw: unknown): RawPost {
  const obj = raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)
    : {};

  const engagement: Record<string, number> = {};
  const reactions = toCount(pick(obj, REACTION_KEYS));
  if (reactions !== undefined) engagement.reactions = reactions;
  const comments = toCount(pick(obj, COMMENT_KEYS));
  if (comments !== undefined) engagement.comments = comments;
  const shares = toCount(pick(obj, SHARE_KEYS));
  if (shares !== undefined) engagement.shares = shares;

  return {
    groupKey: asString(pick(obj, GROUP_KEYS)),
    postId: asString(pick(obj, POST_ID_KEYS)),
    text: asString(pick(obj, TEXT_KEYS)),
    url: asString(pick(obj, URL_KEYS)),
    author: asString(pick(obj, AUTHOR_KEYS)),
    publishedAt: toIso(pick(obj, TIME_KEYS)),
    engagement,
  };
}

/** Body có thể là 1 bài, 1 mảng, hoặc bọc trong posts/items/data. */
function extractPosts(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["posts", "items", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    return [payload]; // 1 bài lẻ
  }
  throw new Error(
    "body phải là object, mảng, hoặc { posts | items | data: [...] }",
  );
}

// ---------------------------------------------------------------------------
// Luồng chính
// ---------------------------------------------------------------------------

export async function ingestPosts(
  payload: unknown,
  supabase: SupabaseClient,
): Promise<IngestResult> {
  const rawPosts = extractPosts(payload);
  log(`nhận ${rawPosts.length} bài thô từ Merlin`);

  // 1. Nạp các group Facebook đang bật -> map group_id và name về source.
  const { data: sourcesRaw, error } = await supabase
    .from("sources")
    .select("id, name, config")
    .eq("type", "facebook")
    .eq("enabled", true);

  if (error) {
    throw new Error(`Đọc bảng sources thất bại: ${error.message}`);
  }
  const sources = (sourcesRaw ?? []) as FacebookSourceRow[];
  if (sources.length === 0) {
    throw new Error(
      "không có source type=facebook đang bật — cần seed group trước",
    );
  }

  const byGroupId = new Map<string, GroupInfo>();
  const byName = new Map<string, GroupInfo>();
  for (const s of sources) {
    const cfg = s.config ?? {};
    const group_id = cfg.group_id === undefined || cfg.group_id === null
      ? ""
      : String(cfg.group_id);
    const info: GroupInfo = { id: s.id, name: s.name, group_id };
    if (group_id !== "") byGroupId.set(group_id, info);
    byName.set(s.name.toLowerCase(), info);
  }
  log(
    `group đang bật: ${
      sources.map((s) => `"${s.name}"(${s.config?.group_id ?? "?"})`).join(
        " | ",
      )
    }`,
  );

  // 2. Chuẩn hóa từng bài, gom theo source.
  const skippedDetails: SkippedPost[] = [];
  const unknownGroups = new Set<string>();
  const pending = new Map<string, ItemInput[]>();
  const infoBySourceId = new Map<string, GroupInfo>();

  for (const raw of rawPosts) {
    const post = extractPost(raw);
    const resolved = post.groupKey
      ? byGroupId.get(post.groupKey) ?? byName.get(post.groupKey.toLowerCase())
      : undefined;

    if (!resolved) {
      const key = post.groupKey ?? "(thiếu group_id)";
      unknownGroups.add(key);
      skippedDetails.push({
        group_id: post.groupKey ?? null,
        post_id: post.postId ?? null,
        reason: "group chưa seed / thiếu group_id",
      });
      continue;
    }
    if (!post.postId) {
      skippedDetails.push({
        group_id: resolved.group_id,
        post_id: null,
        reason: "thiếu post_id",
      });
      continue;
    }
    if (!post.text) {
      skippedDetails.push({
        group_id: resolved.group_id,
        post_id: post.postId,
        reason: "thiếu text",
      });
      continue;
    }

    try {
      const item = normalize({
        source_id: resolved.id,
        external_id: post.postId,
        title: deriveTitle(post.text),
        content: truncate(post.text, MAX_CONTENT_CHARS),
        url: resolveUrl(post.url, resolved.group_id, post.postId),
        author: post.author,
        published_at: post.publishedAt,
        // Luôn gửi object (kể cả rỗng): cột `engagement` là not-null, mà PostgREST
        // bulk-upsert sẽ điền NULL cho row thiếu key (bỏ qua default '{}').
        engagement: post.engagement,
      });
      const bucket = pending.get(resolved.id) ?? [];
      bucket.push(item);
      pending.set(resolved.id, bucket);
      infoBySourceId.set(resolved.id, resolved);
    } catch (err) {
      skippedDetails.push({
        group_id: resolved.group_id,
        post_id: post.postId,
        reason: `normalize lỗi: ${String(err)}`,
      });
    }
  }

  // 3. Upsert theo từng group, bỏ qua trùng (UNIQUE(source_id, external_id)).
  const groups: GroupStat[] = [];
  let insertedTotal = 0;
  let fetchedTotal = 0;

  for (const [sourceId, items] of pending) {
    let inserted = 0;
    for (let i = 0; i < items.length; i += UPSERT_CHUNK) {
      const chunk = items.slice(i, i + UPSERT_CHUNK);
      const { data, error: upsertError } = await supabase
        .from("items")
        .upsert(chunk, {
          onConflict: "source_id,external_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (upsertError) {
        throw new Error(`Upsert items thất bại: ${upsertError.message}`);
      }
      inserted += data?.length ?? 0;
    }

    const info = infoBySourceId.get(sourceId)!;
    const deduped = items.length - inserted;
    insertedTotal += inserted;
    fetchedTotal += items.length;
    groups.push({
      group_id: info.group_id,
      name: info.name,
      fetched: items.length,
      inserted,
      deduped,
    });
    log(
      `group "${info.name}": ${items.length} bài | mới ${inserted} | trùng ${deduped}`,
    );
  }

  log(
    `tổng kết: nhận ${rawPosts.length} | hợp lệ ${fetchedTotal} | mới ${insertedTotal} | trùng ${
      fetchedTotal - insertedTotal
    } | bỏ ${skippedDetails.length}`,
  );

  return {
    ok: true,
    received: rawPosts.length,
    fetched: fetchedTotal,
    inserted: insertedTotal,
    deduped: fetchedTotal - insertedTotal,
    skipped: skippedDetails.length,
    skipped_details: skippedDetails,
    unknown_groups: [...unknownGroups],
    groups,
  };
}

/** Tiện dụng: tự tạo client rồi chạy ingest. */
export async function ingestFacebook(payload: unknown): Promise<IngestResult> {
  return await ingestPosts(payload, createSupabaseClient());
}
