// GitHub collector — phần LOGIC (Supabase Edge Function github-collector).
//
// File này KHÔNG có side-effect khi import: không gọi Deno.serve, không đọc env.
// Nhờ vậy test import trực tiếp được mà không khởi động server trên cổng 8000
// (xem DECISIONS #32 và bài học #33).
//
// Luồng: đọc checkpoint từ sources -> fetch repos mới -> normalize -> upsert items.
//
// Entrypoint (Deno.serve + cờ --once) nằm ở ./index.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalize } from "../_shared/normalize.ts";
import type { ItemInput } from "../_shared/types.ts";

/** Lỗi mạng được thử lại tối đa 3 lần (AGENTS.md mục 5). */
const MAX_RETRIES = 3;

/** Số repo lấy về mỗi lần chạy. */
const PER_PAGE = 30;

const GITHUB_API = "https://api.github.com/search/repositories";
const GITHUB_HEADERS_VERSION = "2022-11-28";
const LOG = "[github-collector]";

/** Cấu hình lấy từ `sources.config` — không hardcode trong code. */
interface GithubSourceConfig {
  /** Từ khóa tìm kiếm, vd "ai coding agent". */
  query?: string;
  /** Ngưỡng sao tối thiểu. */
  min_stars?: number;
  /** Chỉ lấy repo tạo trong vòng N ngày. */
  days?: number;
  /** Checkpoint lần chạy trước. */
  last_seen?: string;
  /** Giữ nguyên mọi field khác khi ghi đè checkpoint. */
  [key: string]: unknown;
}

/** Row `sources` tối thiểu mà collector cần — run-cycle truyền vào. */
export interface GithubSourceRow {
  id: string;
  name: string;
  config: unknown;
}

interface GithubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  stargazers_count: number;
  forks_count: number;
  owner: { login: string } | null;
}

interface GithubSearchResponse {
  total_count: number;
  items: GithubRepo[];
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

/** 403/429 kèm x-ratelimit-remaining: 0 => hết quota. */
function isRateLimited(res: Response): boolean {
  const remaining = res.headers.get("x-ratelimit-remaining");
  return (res.status === 403 || res.status === 429) && remaining === "0";
}

/**
 * Gọi GitHub API, retry tối đa MAX_RETRIES lần với backoff cho lỗi mạng/5xx.
 * Trả về 429/403 hết quota ngay lập tức để caller thoát êm.
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
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
      res = await fetch(url, { headers });
    } catch (err) {
      // Lỗi mạng thật (DNS, timeout, mất kết nối) -> thử lại.
      lastError = err;
      continue;
    }

    // Hết quota: không thử lại, trả về cho caller xử lý.
    if (isRateLimited(res)) return res;

    // 5xx là tạm thời -> thử lại. 4xx khác là lỗi vĩnh viễn -> trả về.
    if (res.status >= 500) {
      lastError = new Error(`HTTP ${res.status}`);
      continue;
    }

    return res;
  }

  throw new Error(
    `GitHub API không phản hồi sau ${MAX_RETRIES + 1} lần thử: ${String(lastError)}`,
  );
}

/** Ngày YYYY-MM-DD cách hôm nay `days` ngày về trước. */
function isoDateDaysAgo(days: number): string {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return since.toISOString().slice(0, 10);
}

/** Dựng URL search theo đúng đặc tả: q + created:> + stars:> */
function buildSearchUrl(
  query: string,
  minStars: number,
  days: number,
): string {
  const url = new URL(GITHUB_API);
  url.searchParams.set(
    "q",
    `${query} created:>${isoDateDaysAgo(days)} stars:>${minStars}`,
  );
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(PER_PAGE));
  return url.toString();
}

/** Repo thô -> ItemInput qua _shared/normalize (không tự xử lý tay). */
function mapRepoToItem(repo: GithubRepo, sourceId: string): ItemInput {
  const description = repo.description?.trim();

  return normalize({
    source_id: sourceId,
    external_id: String(repo.id),
    title: description
      ? `${repo.full_name} — ${description}`
      : repo.full_name,
    url: repo.html_url,
    author: repo.owner?.login,
    published_at: repo.created_at,
    engagement: {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
    },
    content: description || undefined,
  });
}

/** Ghi checkpoint `last_seen`, giữ nguyên các field config khác. */
async function saveCheckpoint(
  supabase: ReturnType<typeof createSupabaseClient>,
  sourceId: string,
  config: GithubSourceConfig,
  lastSeen: string,
): Promise<void> {
  const nextConfig: GithubSourceConfig = { ...config, last_seen: lastSeen };
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

  // 1. Đọc nguồn github đang bật.
  const { data: sources, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, config, enabled")
    .eq("type", "github")
    .eq("enabled", true)
    .limit(1);

  if (sourceError) {
    throw new Error(`Đọc bảng sources thất bại: ${sourceError.message}`);
  }
  if (!sources || sources.length === 0) {
    log("không tìm thấy source type=github đang bật — dừng");
    return;
  }

  await collectSource(supabase, sources[0]);
}

/** 1 source github cụ thể — `run-cycle` đọc sources rồi gọi trực tiếp hàm này. */
export async function collectSource(
  supabase: ReturnType<typeof createSupabaseClient>,
  source: GithubSourceRow,
): Promise<void> {
  const config = (source.config ?? {}) as GithubSourceConfig;

  const query = config.query;
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error('sources.config thiếu "query" hợp lệ');
  }
  const minStars = Number(config.min_stars ?? 50);
  const days = Number(config.days ?? 14);

  log(`source="${source.name}" id=${source.id}`);
  log(
    `config: query="${query}" min_stars=${minStars} days=${days} last_seen=${config.last_seen ?? "(chưa có)"}`,
  );

  // 2. Gọi GitHub Search API.
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_HEADERS_VERSION,
    "User-Agent": "tool-bantin-github-collector",
  };
  const token = Deno.env.get("GITHUB_TOKEN");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    log("dùng GITHUB_TOKEN (đã xác thực)");
  } else {
    log("không có GITHUB_TOKEN — chạy anonymous (10 request/phút)");
  }

  const searchUrl = buildSearchUrl(query, minStars, days);
  log(`GET ${searchUrl}`);

  const res = await fetchWithRetry(searchUrl, headers);

  if (isRateLimited(res)) {
    const reset = res.headers.get("x-ratelimit-reset");
    const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : "?";
    log(`hết quota GitHub, dừng êm (reset lúc ${resetAt}) — không throw`);
    return;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API lỗi HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await res.json()) as GithubSearchResponse;
  const repos = payload.items ?? [];
  log(`fetch: ${repos.length} repo (total_count=${payload.total_count})`);

  if (repos.length === 0) {
    log("upsert mới: 0 | bỏ qua do trùng: 0");
    const now = new Date().toISOString();
    await saveCheckpoint(supabase, source.id, config, now);
    log(`checkpoint last_seen -> ${now}`);
    return;
  }

  // 3. Normalize toàn bộ trước khi ghi.
  const rows = repos.map((repo) => mapRepoToItem(repo, source.id));

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
  const skippedCount = rows.length - newCount;

  log(`upsert mới: ${newCount} | bỏ qua do trùng: ${skippedCount}`);

  // 5. Ghi checkpoint.
  const now = new Date().toISOString();
  await saveCheckpoint(supabase, source.id, config, now);
  log(`checkpoint last_seen -> ${now}`);
}
