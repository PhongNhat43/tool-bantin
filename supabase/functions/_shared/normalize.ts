/**
 * Chuẩn hóa dữ liệu thô từ collector về đúng khuôn `ItemInput`.
 * Mọi collector phải đi qua hàm này trước khi upsert DB.
 */

import type { ItemInput } from "./types.ts";

/**
 * Đầu vào của `normalize` — cùng shape `ItemInput`, chỉ khác `published_at`
 * chấp nhận thêm `Date` cho tiện. Không thêm field nào ngoài `ItemInput`.
 */
export type NormalizeInput = Omit<ItemInput, "published_at"> & {
  published_at?: string | Date;
};

/** Field bắt buộc — thiếu là throw. */
const REQUIRED_FIELDS = ["source_id", "external_id", "title", "url"] as const;

/**
 * Tham số tracking cần lột khỏi URL.
 * Bắt đầu bằng `utm_` thì luôn bỏ; còn lại là danh sách đã biết.
 */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "twclid",
  "ttclid",
  "igshid",
  "igsh",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "vero_id",
  "vero_conv",
  "_hsenc",
  "_hsmi",
  "hsCtaTracking",
  "ref_src",
  "ref_url",
  "spm",
  "scm",
  "__twitter_impression",
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

/**
 * Chuẩn hóa URL:
 * - Bỏ tham số tracking (utm_*, fbclid, gclid, ...), giữ nguyên các tham số khác.
 * - Host viết thường, bỏ port mặc định, bỏ user/password.
 * - Bỏ `?` và `#` rỗng ở cuối.
 */
export function normalizeUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`url không hợp lệ: "${rawUrl}"`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `url phải là http hoặc https, nhận được: "${parsed.protocol}"`,
    );
  }

  // URL tự bỏ port mặc định (80/443) và username/password khi serialize.
  parsed.hash = parsed.hash === "#" ? "" : parsed.hash;

  const keptParams = [...parsed.searchParams.entries()].filter(
    ([name]) => !isTrackingParam(name),
  );

  parsed.search = "";
  for (const [name, value] of keptParams) {
    parsed.searchParams.append(name, value);
  }

  let result = parsed.toString();

  // `new URL` luôn thêm "/" cho origin trần. Bỏ đi để "https://a.com",
  // "https://a.com/" và "https://a.com/?x=1" không bị dedup thành 3 URL khác nhau.
  if (parsed.pathname === "/") {
    result = result.replace(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)\/(?=[?#]|$)/i, "$1");
  }

  return result;
}

/** Chuẩn hóa `published_at` về ISO string. Nhận `Date` hoặc string ISO. */
export function normalizePublishedAt(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`published_at không hợp lệ: "${String(value)}"`);
  }

  return date.toISOString();
}

/** Trim; chuỗi rỗng hoặc toàn khoảng trắng -> undefined. */
function trimToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Trim nhưng giữ nguyên rỗng — dùng cho field bắt buộc để báo lỗi rõ ràng. */
function trimToEmpty(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/**
 * Chuẩn hóa 1 item thô.
 *
 * @throws Error liệt kê rõ những field bắt buộc bị thiếu/rỗng.
 */
export function normalize(input: NormalizeInput): ItemInput {
  const source_id = trimToEmpty(input?.source_id);
  const external_id = trimToEmpty(input?.external_id);
  const title = trimToEmpty(input?.title);
  const url = trimToEmpty(input?.url);

  const values: Record<(typeof REQUIRED_FIELDS)[number], string> = {
    source_id,
    external_id,
    title,
    url,
  };

  const missing = REQUIRED_FIELDS.filter((field) => values[field] === "");
  if (missing.length > 0) {
    throw new Error(
      `Thiếu field bắt buộc: ${missing.join(", ")} (source_id/external_id/title/url không được rỗng)`,
    );
  }

  const result: ItemInput = {
    source_id,
    external_id,
    title,
    url: normalizeUrl(url),
  };

  const content = trimToUndefined(input.content);
  if (content !== undefined) result.content = content;

  const author = trimToUndefined(input.author);
  if (author !== undefined) result.author = author;

  if (input.published_at !== undefined && input.published_at !== null) {
    result.published_at = normalizePublishedAt(input.published_at);
  }

  if (input.engagement !== undefined && input.engagement !== null) {
    result.engagement = { ...input.engagement };
  }

  return result;
}
