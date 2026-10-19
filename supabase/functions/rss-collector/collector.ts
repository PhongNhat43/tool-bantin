// RSS/Atom collector — phần LOGIC (Supabase Edge Function rss-collector).
//
// File này KHÔNG có side-effect khi import: không gọi Deno.serve, không đọc env.
// Nhờ vậy test import trực tiếp được mà không khởi động server trên cổng 8000.
// Xem DECISIONS #32: Deno.serve mặc định bind 127.0.0.1:8000 và bị các tiến trình
// khác trong máy (vd health-check của editor) gọi vào -> handler chạy thêm 1 lượt
// runCollector song song, làm test đếm sai số lần gọi mạng.
//
// Nguồn: mọi bản ghi `sources` có type='rss' và enabled=true (mỗi feed 1 bản ghi).
// Luồng: đọc checkpoint từng source -> fetch feed -> parse XML -> lọc entry mới hơn
//        last_seen -> normalize -> upsert items -> ghi lại last_seen.
// Khác 2 collector trước: KHÔNG lấy limit(1) mà chạy hết mọi source rss đang bật,
// và mỗi source nằm trong try/catch riêng để 1 feed hỏng không kéo đổ cả kỳ quét
// (cùng tinh thần với orchestrator run-cycle ở AGENTS.md mục 6).
//
// Entrypoint (Deno.serve + cờ --once) nằm ở ./index.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { normalize } from "../_shared/normalize.ts";
import { attr, decodeEntities, findAll, findFirst, parseXml, textContent, type XmlNode } from "../_shared/xml.ts";
import type { ItemInput } from "../_shared/types.ts";

/** Lỗi mạng/timeout được thử lại tối đa 3 lần (AGENTS.md mục 5). */
const MAX_RETRIES = 3;

/** Timeout mỗi lần gọi feed. Feed treo không được kéo dài cả kỳ quét. */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Cắt bớt `content` (schema ghi là "tóm tắt / nội dung ngắn").
 * Feed Simon Willison nhét cả bài vào <summary> (tới 6.5k ký tự), không cắt thì
 * mỗi row phình to mà dashboard chỉ hiển thị 1–2 dòng.
 */
const MAX_CONTENT_CHARS = 1000;

const LOG = "[rss-collector]";

/** Cấu hình lấy từ `sources.config` — không hardcode trong code. */
interface RssSourceConfig {
  /** URL feed (RSS 2.0 / Atom / RDF). */
  url?: string;
  /** Checkpoint lần chạy trước (ISO). */
  last_seen?: string;
  /** Giữ nguyên mọi field khác khi ghi đè checkpoint. */
  [key: string]: unknown;
}

/** 1 entry đã bóc khỏi XML, chưa qua normalize. */
interface RawEntry {
  externalId: string;
  title: string;
  url: string;
  author?: string;
  /** Tóm tắt đã lột HTML + cắt ngắn. */
  content?: string;
  /** Epoch ms, null khi entry không có ngày publish. */
  publishedMs: number | null;
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

/** 429 và 5xx là lỗi tạm thời -> thử lại. 4xx khác là lỗi vĩnh viễn -> trả luôn. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Gọi feed, retry tối đa MAX_RETRIES lần với backoff cho lỗi mạng/timeout/429/5xx.
 * Nếu hết lượt mà vẫn lỗi tạm thời thì trả response cuối về cho caller tự quyết,
 * chỉ throw khi không nhận được response nào (mất mạng hoàn toàn).
 */
async function fetchFeed(url: string): Promise<Response> {
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const waitMs = 500 * 2 ** (attempt - 1);
      log(
        `gọi lại lần ${attempt}/${MAX_RETRIES} sau ${waitMs}ms (lỗi mạng/timeout hoặc HTTP 429/5xx) — ${String(lastError)}`,
      );
      await sleep(waitMs);
    }

    try {
      const res = await fetch(url, {
        headers: {
          Accept:
            "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": "tool-bantin-rss-collector",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      lastResponse = res;
      if (!isRetryableStatus(res.status)) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      // Lỗi mạng thật (DNS, timeout, mất kết nối) -> thử lại.
      lastError = err;
      lastResponse = null;
    }
  }

  if (lastResponse) return lastResponse;

  throw new Error(
    `Feed không phản hồi sau ${MAX_RETRIES + 1} lần thử: ${String(lastError)}`,
  );
}

/** Checkpoint -> epoch ms; không có/không hợp lệ -> null (coi như lần chạy đầu). */
function parseLastSeen(lastSeen: string | undefined): number | null {
  if (typeof lastSeen !== "string" || lastSeen.trim() === "") return null;

  const parsed = Date.parse(lastSeen);
  if (Number.isNaN(parsed)) {
    log(`cảnh báo: last_seen không hợp lệ ("${lastSeen}") — coi như chưa có checkpoint`);
    return null;
  }

  return parsed;
}

/** Text con trực tiếp, trim; rỗng thì undefined. */
function childText(node: XmlNode, name: string): string | undefined {
  const child = findFirst(node, name);
  if (!child) return undefined;

  const value = textContent(child).trim();
  return value === "" ? undefined : value;
}

/**
 * HTML trong feed -> text thuần, đã cắt ngắn.
 * Phải làm vì `<summary>` (Atom) và `<description>` (RSS) chứa HTML (có khi cả
 * `<script>`); lưu nguyên HTML thì dashboard phải tự sanitize, dễ XSS.
 *
 * Lưu ý thứ tự: phải lột thẻ TRƯỚC rồi mới giải entity lần 2.
 * Summary của Atom bị escape 2 tầng — XML giải 1 tầng khi parse (`&amp;lt;` ->
 * `&lt;`), còn lại là HTML của summary nên cần giải thêm 1 tầng nữa (`&lt;` ->
 * `<`). Nếu giải trước khi lột thẻ thì `<script>` vừa hiện ra sẽ bị xoá luôn.
 */
function htmlToText(html: string): string | undefined {
  const text = decodeEntities(
    html
      // Bỏ cả nội dung bên trong script/style, không chỉ thẻ.
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p\s*>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();

  if (text === "") return undefined;
  if (text.length <= MAX_CONTENT_CHARS) return text;

  return `${text.slice(0, MAX_CONTENT_CHARS).trimEnd()}\u2026`;
}

/**
 * URL của entry.
 * - Atom: ưu tiên `<link rel="alternate" href>`, rồi `<link href>` bất kỳ, rồi `<id>` nếu là URL.
 * - RSS:  `<link>` dạng text; không có thì `<guid isPermaLink>` nếu là URL.
 */
function entryUrl(node: XmlNode, isAtom: boolean): string | undefined {
  if (isAtom) {
    const links = node.children.filter((child) => child.name === "link");

    const preferred = links.find((link) => {
      const rel = attr(link, "rel") ?? "alternate";
      return rel === "alternate" && (attr(link, "href") ?? "").trim() !== "";
    }) ?? links.find((link) => (attr(link, "href") ?? "").trim() !== "");

    const href = preferred ? attr(preferred, "href")?.trim() : undefined;
    if (href) return href;

    const id = childText(node, "id");
    return id && /^https?:\/\//i.test(id) ? id : undefined;
  }

  const link = childText(node, "link");
  if (link) return link;

  const guidNode = findFirst(node, "guid");
  if (guidNode && (attr(guidNode, "isPermaLink") ?? "true") !== "false") {
    const guid = textContent(guidNode).trim();
    if (/^https?:\/\//i.test(guid)) return guid;
  }

  return undefined;
}

/** external_id = guid/id, fallback dùng link (theo spec Task 1.5). */
function entryExternalId(
  node: XmlNode,
  isAtom: boolean,
  url: string,
): string {
  if (isAtom) return childText(node, "id") ?? url;
  return childText(node, "guid") ?? url;
}

/** Tác giả: Atom `<author><name>`; RSS `<author>` hoặc `<dc:creator>`. */
function entryAuthor(node: XmlNode, isAtom: boolean): string | undefined {
  if (isAtom) {
    const author = findFirst(node, "author");
    if (!author) return undefined;

    const name = childText(author, "name");
    if (name) return name;

    const flat = textContent(author).trim();
    return flat === "" ? undefined : flat;
  }

  return childText(node, "author") ?? childText(node, "creator");
}

/**
 * Ngày publish (epoch ms) hoặc null nếu entry không khai báo ngày.
 * - Atom: `<published>`, không có thì `<updated>`.
 * - RSS:  `<pubDate>`, không có thì `<dc:date>` / `<published>` / `<updated>`.
 */
function entryPublishedMs(node: XmlNode, isAtom: boolean): number | null {
  const raw = isAtom
    ? childText(node, "published") ?? childText(node, "updated")
    : childText(node, "pubDate") ?? childText(node, "date") ??
      childText(node, "published") ?? childText(node, "updated");

  if (!raw) return null;

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Tác giả khai báo ở cấp feed/channel.
 * Cần thiết vì nhiều feed (vd Simon Willison) CHỈ khai author ở cấp feed, mọi
 * entry đều không có `<author>` — không có fallback này thì `items.author` luôn null.
 * - Atom: `<feed><author><name>`.
 * - RSS:  `<channel><author>` / `<managingEditor>` / `<dc:creator>`.
 */
function feedAuthor(root: XmlNode, isAtom: boolean): string | undefined {
  if (isAtom) {
    const author = findFirst(root, "author");
    if (!author) return undefined;

    const name = childText(author, "name");
    if (name) return name;

    const flat = textContent(author).trim();
    return flat === "" ? undefined : flat;
  }

  const channel = findFirst(root, "channel") ?? root;
  return childText(channel, "author") ??
    childText(channel, "managingEditor") ??
    childText(channel, "creator");
}

/**
 * Tóm tắt của entry, đã lột HTML.
 * - Atom: `<summary>`, không có thì `<content>`.
 * - RSS:  `<description>`, không có thì `<content:encoded>` (local name "encoded")
 *         rồi `<summary>`.
 */
function entryContent(node: XmlNode, isAtom: boolean): string | undefined {
  const raw = isAtom
    ? childText(node, "summary") ?? childText(node, "content")
    : childText(node, "description") ?? childText(node, "encoded") ??
      childText(node, "summary") ?? childText(node, "content");

  return raw ? htmlToText(raw) : undefined;
}

/** 1 element entry -> RawEntry; thiếu title hoặc url thì trả null (không bịa dữ liệu). */
function extractEntry(
  node: XmlNode,
  isAtom: boolean,
  fallbackAuthor?: string,
): RawEntry | null {
  const title = childText(node, "title");
  const url = entryUrl(node, isAtom);

  if (!title || !url) return null;

  return {
    externalId: entryExternalId(node, isAtom, url),
    title,
    url,
    author: entryAuthor(node, isAtom) ?? fallbackAuthor,
    content: entryContent(node, isAtom),
    publishedMs: entryPublishedMs(node, isAtom),
  };
}

/** Entry -> ItemInput qua _shared/normalize (không tự xử lý tay). */
function mapEntryToItem(entry: RawEntry, sourceId: string): ItemInput {
  return normalize({
    source_id: sourceId,
    external_id: entry.externalId,
    title: entry.title,
    url: entry.url,
    author: entry.author,
    content: entry.content,
    published_at: entry.publishedMs === null
      ? undefined
      : new Date(entry.publishedMs),
    // RSS không có số liệu tương tác. Để {} — Task 2.1 sẽ cho điểm cố định 15
    // theo allowlist (AGENTS.md mục 6), KHÔNG dùng engagement của nguồn này.
    engagement: {},
  });
}

/** Ghi checkpoint `last_seen`, giữ nguyên các field config khác. */
async function saveCheckpoint(
  supabase: ReturnType<typeof createSupabaseClient>,
  sourceId: string,
  config: RssSourceConfig,
  lastSeen: string,
): Promise<void> {
  const nextConfig: RssSourceConfig = { ...config, last_seen: lastSeen };
  const { error } = await supabase
    .from("sources")
    .update({ config: nextConfig })
    .eq("id", sourceId);

  if (error) {
    throw new Error(`Cập nhật checkpoint thất bại: ${error.message}`);
  }
}

interface RssSourceRow {
  id: string;
  name: string;
  config: unknown;
}

/** Chạy 1 feed. Throw khi lỗi không tự xử lý được; caller bọc try/catch. */
async function collectSource(
  supabase: ReturnType<typeof createSupabaseClient>,
  source: RssSourceRow,
): Promise<void> {
  const config = (source.config ?? {}) as RssSourceConfig;

  const url = typeof config.url === "string" ? config.url.trim() : "";
  if (url === "") {
    throw new Error('sources.config thiếu "url" hợp lệ');
  }

  const lastSeenMs = parseLastSeen(config.last_seen);

  log(`source "${source.name}" id=${source.id}`);
  log(`GET ${url}`);
  log(
    `checkpoint last_seen = ${config.last_seen ?? "(chưa có — lấy tất cả entry)"}`,
  );

  const res = await fetchFeed(url);

  // Feed chết hẳn: chỉ báo động, KHÔNG tự tắt source, KHÔNG ghi checkpoint.
  if (res.status === 404 || res.status === 410) {
    const body = await res.text().catch(() => "");
    log(
      `⛔ FEED CHẾT (HTTP ${res.status}) — CẦN KIỂM TRA THỦ CÔNG: ${url}`,
    );
    log(`   giữ nguyên enabled=${true}, không ghi checkpoint. Phản hồi: ${body.slice(0, 120)}`);
    return;
  }

  if (res.status === 429) {
    // Không ghi checkpoint: lần sau vẫn quét lại đúng khoảng này (DECISIONS #18).
    log("feed trả 429, dừng êm cho source này (giữ nguyên checkpoint) — không throw");
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Feed lỗi HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const xmlText = await res.text();
  const root = parseXml(xmlText);
  const isAtom = root.name.toLowerCase() === "feed";
  const feedAuthorValue = feedAuthor(root, isAtom);

  // Atom dùng <entry>, RSS/RDF dùng <item>. Thử cả hai để chịu được feed dị dạng.
  let entryTag = isAtom ? "entry" : "item";
  let entries = findAll(root, entryTag);
  if (entries.length === 0) {
    entryTag = isAtom ? "item" : "entry";
    entries = findAll(root, entryTag);
  }

  log(
    `feed "${source.name}": ${entries.length} entry thô (định dạng ${root.name}, thẻ <${entryTag}>)` +
      ` | author cấp feed: ${feedAuthorValue ?? "(không khai báo)"}`,
  );

  if (entries.length === 0) {
    log("không có entry nào — giữ nguyên checkpoint. upsert mới: 0 | bỏ qua do trùng: 0");
    return;
  }

  // 1. Bóc entry + lọc theo checkpoint.
  const rawEntries: RawEntry[] = [];
  let skippedOld = 0;
  let undatedKept = 0;
  let skippedMalformed = 0;
  let feedMaxMs: number | null = null;

  for (const node of entries) {
    const entry = extractEntry(node, isAtom, feedAuthorValue);

    if (!entry) {
      skippedMalformed++;
      continue;
    }

    // Mốc checkpoint tiến theo entry mới nhất CÓ ngày trong feed.
    if (entry.publishedMs !== null) {
      if (feedMaxMs === null || entry.publishedMs > feedMaxMs) {
        feedMaxMs = entry.publishedMs;
      }
    }

    if (entry.publishedMs === null) {
      // Entry không khai báo ngày: không so sánh được với checkpoint. Vẫn lấy và
      // để UNIQUE(source_id, external_id) chặn trùng, thay vì bỏ mất dữ liệu.
      rawEntries.push(entry);
      undatedKept++;
      continue;
    }

    if (lastSeenMs === null || entry.publishedMs > lastSeenMs) {
      rawEntries.push(entry);
    } else {
      skippedOld++;
    }
  }

  log(
    `lọc theo last_seen: ${rawEntries.length - undatedKept} entry mới hơn | ` +
      `bỏ qua vì cũ hơn: ${skippedOld} | không có ngày (luôn xét): ${undatedKept} | ` +
      `bỏ vì thiếu title/url: ${skippedMalformed} | ` +
      `có tóm tắt: ${rawEntries.filter((entry) => entry.content !== undefined).length}/${rawEntries.length}`,
  );

  // 2. Normalize.
  const rows: ItemInput[] = [];
  for (const entry of rawEntries) {
    try {
      rows.push(mapEntryToItem(entry, source.id));
    } catch (err) {
      skippedMalformed++;
      log(`bỏ 1 entry không normalize được: ${String(err)}`);
    }
  }

  // 3. Upsert, bỏ qua trùng. ignoreDuplicates => RETURNING chỉ trả row thật sự chèn.
  if (rows.length === 0) {
    log("upsert mới: 0 | bỏ qua do trùng: 0");
  } else {
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
  }

  // 4. Ghi checkpoint = entry mới nhất có ngày trong feed, nhưng KHÔNG bao giờ lùi.
  if (feedMaxMs === null) {
    log("feed không có entry nào kèm ngày — giữ nguyên checkpoint");
    return;
  }

  if (lastSeenMs !== null && feedMaxMs <= lastSeenMs) {
    log("checkpoint không đổi (feed chưa có gì mới hơn last_seen)");
    return;
  }

  const next = new Date(feedMaxMs).toISOString();
  await saveCheckpoint(supabase, source.id, config, next);
  log(`checkpoint last_seen -> ${next}`);
}

export async function runCollector(): Promise<void> {
  const supabase = createSupabaseClient();

  // 1. Đọc TẤT CẢ nguồn rss đang bật (mỗi feed là 1 bản ghi sources).
  const { data: sources, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, config, enabled")
    .eq("type", "rss")
    .eq("enabled", true)
    .order("name");

  if (sourceError) {
    throw new Error(`Đọc bảng sources thất bại: ${sourceError.message}`);
  }
  if (!sources || sources.length === 0) {
    log("không tìm thấy source type=rss đang bật — dừng");
    return;
  }

  log(`có ${sources.length} source rss đang bật: ${sources.map((s) => s.name).join(", ")}`);

  // 2. Mỗi feed 1 try/catch riêng: 1 feed chết không kéo đổ các feed còn lại.
  let succeeded = 0;
  const failed: string[] = [];

  for (const source of sources) {
    try {
      await collectSource(supabase, source);
      succeeded++;
    } catch (err) {
      console.error(LOG, `source "${source.name}" lỗi:`, err);
      failed.push(source.name);
    }
  }

  log(
    `tổng kết: ${succeeded}/${sources.length} feed chạy xong` +
      (failed.length > 0 ? ` | lỗi: ${failed.join(", ")}` : ""),
  );

  // Chỉ throw khi KHÔNG feed nào chạy được, để orchestrator thấy đây là kỳ quét hỏng.
  if (succeeded === 0 && failed.length > 0) {
    throw new Error(`tất cả ${failed.length} feed rss đều lỗi: ${failed.join(", ")}`);
  }
}
