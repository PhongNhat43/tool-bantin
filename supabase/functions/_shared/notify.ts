/**
 * Gửi thông báo Telegram + chống gửi trùng — Task 2.2.
 *
 * Lib KHÔNG tự tạo Supabase client: `run-cycle` tạo client rồi truyền vào
 * (giống cách collector nhận client), nhờ vậy test được bằng mock offline.
 *
 * Luồng chống trùng:
 *   1. Đọc `notification_log` theo (item_id, channel='telegram').
 *   2. Đã có log  → `skipped`, không gọi Telegram.
 *   3. Gọi Telegram; chỉ khi HTTP ok VÀ body `{ ok: true }` mới insert log.
 *   4. Lỗi mạng/Telegram từ chối → throw, KHÔNG ghi log → kỳ sau thử lại.
 *
 * Tin ≥ 70 điểm (hoặc trigger báo ngay) đi `sendInstant` — 1 tin nhắn/tin,
 * preview bật. Tin 40–69 gom `sendDigest` — 1 tin nhắn/lô, preview tắt.
 */

export interface NotifyItem {
  /** `items.id` (uuid) — khóa chống gửi trùng. */
  id: string;
  title: string;
  url?: string | null;
  source_name: string;
  score: number;
  /** Lý do báo ngay do `scoreItem` trả về (chỉ có ở tin báo ngay). */
  notify_reason?: string;
}

/** Lỗi PostgREST tối thiểu mà lib cần đọc. */
export interface NotifyDbError {
  message: string;
}

/** Kết quả 1 query PostgREST tối thiểu. */
export interface NotifyDbResult<T> {
  data: T | null;
  error: NotifyDbError | null;
}

/**
 * Builder query tối thiểu — đủ để dùng với Supabase JS thật và mock trong test.
 * Supabase `PostgrestFilterBuilder` là thenable nên `await` được trực tiếp.
 */
export interface NotifyQuery<T = unknown>
  extends PromiseLike<NotifyDbResult<T>> {
  eq(column: string, value: string): NotifyQuery<T>;
  in(column: string, values: readonly string[]): NotifyQuery<T>;
  maybeSingle(): PromiseLike<NotifyDbResult<T>>;
}

export interface NotifyTable {
  select(columns?: string): NotifyQuery<unknown>;
  insert(
    values: Record<string, unknown> | Record<string, unknown>[],
  ): PromiseLike<{ error: NotifyDbError | null }>;
}

/** Chỉ cần `from()` — không import/khởi tạo Supabase client trong lib. */
export interface NotifyDb {
  /**
   * Trả `unknown` thay vì `NotifyTable` để `SupabaseClient` thật gán được mà
   * không nổ TS2589 (generic Postgrest lồng quá sâu). Lib tự cast về
   * `NotifyTable` — phần logic bên trong vẫn có type đầy đủ.
   */
  from(table: string): unknown;
}

/**
 * Lấy query builder đã cast. Chỉ là ranh giới tin cậy giữa SupabaseClient thật
 * và shape tối thiểu mà lib dùng.
 */
function table(supabase: NotifyDb): NotifyTable {
  return supabase.from("notification_log") as NotifyTable;
}

/** Kiểu hàm fetch — inject mock trong test, mặc định `fetch` toàn cục. */
export type NotifyFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

const TELEGRAM_API_BASE = "https://api.telegram.org";
const CHANNEL = "telegram";

/** Giới hạn của Telegram cho 1 tin nhắn text. */
const TELEGRAM_MAX_TEXT = 4096;

/** Tiêu đề dài hơn 150 ký tự bị cắt (tính cả dấu …). */
const MAX_TITLE_LENGTH = 150;

/** Ngày theo giờ Việt Nam (UTC+7, không có DST) — định dạng dd/mm/yyyy. */
function formatDate(date: Date): string {
  const vn = new Date(date.getTime() + 7 * 3_600_000);
  const day = String(vn.getUTCDate()).padStart(2, "0");
  const month = String(vn.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${vn.getUTCFullYear()}`;
}

/** Escape 3 ký tự có nghĩa trong HTML của Telegram. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape thêm dấu `"` khi đặt trong attribute `href="..."`. */
function escapeHtmlAttribute(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

/** Cắt tiêu đề > 150 ký tự, giữ nguyên nếu đủ ngắn. */
function truncateTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

/** Đọc secrets — thiếu là throw NGAY, trước khi query/gửi bất cứ thứ gì. */
function readTelegramConfig(): { token: string; chatId: string } {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim() ?? "";
  const chatId = Deno.env.get("NOTIFY_CHAT_ID")?.trim() ?? "";

  const missing = [
    token === "" ? "TELEGRAM_BOT_TOKEN" : null,
    chatId === "" ? "NOTIFY_CHAT_ID" : null,
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new Error(
      `Thiếu secret Telegram: ${missing.join(", ")} — set trong Supabase secrets/.env rồi chạy lại.`,
    );
  }

  return { token, chatId };
}

/** Lỗi bất kỳ -> chuỗi; dùng cho thông báo throw. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Gọi Telegram sendMessage; chỉ resolve khi Telegram trả `ok: true`. */
async function callTelegram(
  fetchFn: NotifyFetch,
  token: string,
  chatId: string,
  text: string,
  disablePreview: boolean,
): Promise<void> {
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: disablePreview,
      }),
    });
  } catch (error) {
    throw new Error(`Không gọi được Telegram API: ${errorMessage(error)}`);
  }

  let body: { ok?: boolean; description?: string } | null = null;
  try {
    body = await response.json();
  } catch {
    // Body không phải JSON — bên dưới sẽ throw kèm HTTP status.
  }

  if (!response.ok || body?.ok !== true) {
    const detail = body?.description ?? `HTTP ${response.status}`;
    throw new Error(`Telegram từ chối gửi tin: ${detail}`);
  }
}

/** Đã có log (item_id, channel) chưa. Lỗi query -> throw để kỳ sau thử lại. */
async function wasSent(supabase: NotifyDb, itemId: string): Promise<boolean> {
  const { data, error } = await table(supabase)
    .select("id")
    .eq("item_id", itemId)
    .eq("channel", CHANNEL)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Không đọc được notification_log cho item ${itemId}: ${error.message}`,
    );
  }

  return data !== null && data !== undefined;
}

/** Các item đã gửi trong 1 lần query (digest) — tránh N query lặp. */
async function sentItemIds(
  supabase: NotifyDb,
  itemIds: readonly string[],
): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();

  const { data, error } = await table(supabase)
    .select("item_id")
    .eq("channel", CHANNEL)
    .in("item_id", itemIds);

  if (error) {
    throw new Error(`Không đọc được notification_log: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return new Set(
    rows
      .map((row) =>
        typeof row === "object" && row !== null
          ? (row as { item_id?: unknown }).item_id
          : undefined
      )
      .filter((id): id is string => typeof id === "string"),
  );
}

/**
 * Ghi log CHỈ sau khi Telegram đã nhận. Insert lỗi phải throw: thà lộ lỗi còn
 * hơn âm thầm mất dấu (kỳ sau có thể gửi trùng).
 */
async function logSent(
  supabase: NotifyDb,
  itemIds: readonly string[],
): Promise<void> {
  if (itemIds.length === 0) return;

  const { error } = await table(supabase)
    .insert(itemIds.map((item_id) => ({ item_id, channel: CHANNEL })));

  if (error) {
    throw new Error(
      `Telegram đã gửi nhưng không ghi được notification_log: ${error.message}`,
    );
  }
}

/** Text 1 tin: tiêu đề đậm + dòng meta + link gốc (preview bật). */
export function buildInstantText(item: NotifyItem): string {
  const lines = [`<b>${escapeHtml(truncateTitle(item.title))}</b>`];

  const meta = [escapeHtml(item.source_name), `${item.score} điểm`];
  if (item.notify_reason) meta.push(escapeHtml(item.notify_reason));
  lines.push(meta.join(" · "));

  if (item.url) {
    lines.push(
      `<a href="${escapeHtmlAttribute(item.url)}">Mở bài gốc</a>`,
    );
  }

  return lines.join("\n");
}

/** Text digest: 1 header + bullet, tự cắt nếu vượt 4096 ký tự. */
export function buildDigestText(
  items: readonly NotifyItem[],
  now = new Date(),
): { text: string; kept: NotifyItem[] } {
  const header = `📰 Bản tin AI — ${formatDate(now)}`;
  const bullets = items.map((item) => {
    const title = escapeHtml(truncateTitle(item.title));
    const source = escapeHtml(item.source_name);
    const link = item.url
      ? ` · <a href="${escapeHtmlAttribute(item.url)}">link</a>`
      : "";
    return `• [${item.score}] ${title} — ${source}${link}`;
  });

  const full = `${header}\n${bullets.join("\n")}`;
  if (full.length <= TELEGRAM_MAX_TEXT) {
    return { text: full, kept: [...items] };
  }

  // Bỏ dần bullet CUỐI cho tới khi vừa 4096, kèm dòng "…và N tin khác".
  for (let kept = bullets.length - 1; kept >= 0; kept--) {
    const omitted = bullets.length - kept;
    const body = kept === 0
      ? header
      : `${header}\n${bullets.slice(0, kept).join("\n")}`;
    const text = `${body}\n…và ${omitted} tin khác`;
    if (text.length <= TELEGRAM_MAX_TEXT) {
      return { text, kept: items.slice(0, kept) };
    }
  }

  // Header ngắn nên nhánh này gần như không bao giờ xảy ra.
  return {
    text: `${header}\n…và ${items.length} tin khác`,
    kept: [],
  };
}

/**
 * Gửi NGAY 1 tin (1 tin nhắn/item). Đã gửi trước đó -> `skipped`.
 * Preview bật để Telegram hiện thẻ link của bài gốc.
 */
export async function sendInstant(
  supabase: NotifyDb,
  item: NotifyItem,
  fetchFn: NotifyFetch = fetch,
): Promise<"sent" | "skipped"> {
  const { token, chatId } = readTelegramConfig();

  if (await wasSent(supabase, item.id)) return "skipped";

  await callTelegram(
    fetchFn,
    token,
    chatId,
    buildInstantText(item),
    false,
  );

  await logSent(supabase, [item.id]);
  return "sent";
}

/**
 * Gửi 1 digest cho cả lô tin 40–69 điểm: đúng 1 tin nhắn, preview tắt.
 *
 * - Bỏ các item đã có log; không còn item nào -> `skipped`.
 * - Vượt 4096 ký tự: bỏ bullet cuối + ghi "…và N tin khác".
 * - CHỈ log những item thực sự nằm trong tin nhắn (item bị cắt không log,
 *   kỳ sau còn cơ hội gửi lại).
 */
export async function sendDigest(
  supabase: NotifyDb,
  items: readonly NotifyItem[],
  fetchFn: NotifyFetch = fetch,
): Promise<"sent" | "skipped"> {
  const { token, chatId } = readTelegramConfig();

  // Chống trùng + chống trùng id trong cùng lô (giữ thứ tự xuất hiện).
  const unique: NotifyItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  if (unique.length === 0) return "skipped";

  const alreadySent = await sentItemIds(
    supabase,
    unique.map((item) => item.id),
  );
  const pending = unique.filter((item) => !alreadySent.has(item.id));
  if (pending.length === 0) return "skipped";

  const { text, kept } = buildDigestText(pending);

  await callTelegram(fetchFn, token, chatId, text, true);

  await logSent(supabase, kept.map((item) => item.id));
  return "sent";
}
