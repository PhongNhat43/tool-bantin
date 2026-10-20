import type { SupabaseClient } from "@supabase/supabase-js";

/** JSON trong `sources.config` — mỗi loại nguồn dùng key khác nhau. */
export type SourceConfig = Record<string, unknown>;

export type ManagedSource = {
  id: string;
  name: string;
  type: string;
  config: SourceConfig;
  enabled: boolean;
  created_at: string;
  /** Số item đã thu thập; null khi query count lỗi (hiện "?"). */
  itemCount: number | null;
};

/** Thứ tự hiển thị: nguồn chủ động trước, facebook (bị động) cuối. */
const TYPE_ORDER: Record<string, number> = {
  github: 0,
  hackernews: 1,
  rss: 2,
  reddit: 3,
  youtube: 4,
  facebook: 5,
};

const SOURCE_FIELDS = "id, name, type, config, enabled, created_at";

function sortSources(a: ManagedSource, b: ManagedSource): number {
  const byType = (TYPE_ORDER[a.type] ?? 4) - (TYPE_ORDER[b.type] ?? 4);
  if (byType !== 0) return byType;
  return a.name.localeCompare(b.name, "vi");
}

/**
 * Đọc toàn bộ nguồn + số item mỗi nguồn.
 * Count chạy song song từng nguồn (6–10 nguồn nên vẫn nhẹ); 1 count lỗi
 * không làm hỏng cả danh sách, chỉ hiện "?" ở dòng đó.
 */
export async function fetchManagedSources(
  client: SupabaseClient,
): Promise<ManagedSource[]> {
  const { data, error } = await client
    .from("sources")
    .select(SOURCE_FIELDS)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Omit<ManagedSource, "itemCount">[];

  const withCounts = await Promise.all(
    rows.map(async (row) => {
      const { count, error: countError } = await client
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("source_id", row.id);

      return {
        ...row,
        config: (row.config ?? {}) as SourceConfig,
        itemCount: countError ? null : (count ?? 0),
      };
    }),
  );

  return withCounts.sort(sortSources);
}

/** Bật/tắt nguồn. `.select()` để phát hiện RLS chặn UPDATE (0 dòng, không lỗi). */
export async function setSourceEnabled(
  client: SupabaseClient,
  id: string,
  enabled: boolean,
): Promise<void> {
  const { data, error } = await client
    .from("sources")
    .update({ enabled })
    .eq("id", id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Không dòng nào được cập nhật — kiểm tra policy UPDATE của bảng sources.",
    );
  }
}

export type NewSourceType = "github" | "hackernews" | "rss";

export type NewSourcePayload = {
  type: NewSourceType;
  name: string;
  config: SourceConfig;
};

export type NewSourceForm = {
  type: NewSourceType;
  githubQuery: string;
  githubMinStars: string;
  githubDays: string;
  hnQueries: string;
  hnMinPoints: string;
  rssName: string;
  rssFeedUrl: string;
};

export type BuildResult =
  | { ok: true; value: NewSourcePayload }
  | { ok: false; error: string };

/** Số nguyên >= min; chuỗi rỗng dùng giá trị mặc định. */
function parseInteger(
  raw: string,
  label: string,
  fallback: number,
  min: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: fallback };

  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: `${label} phải là số nguyên ≥ ${min}.` };
  }

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < min) {
    return { ok: false, error: `${label} phải là số nguyên ≥ ${min}.` };
  }

  return { ok: true, value };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate form + dựng row `sources` (chưa gọi DB).
 *
 * Key config bám đúng collector:
 *   github     -> { query, min_stars, days }
 *   hackernews -> { queries: string[], min_points }
 *   rss        -> { url }  (rss-collector đọc config.url)
 */
export function buildNewSource(form: NewSourceForm): BuildResult {
  if (form.type === "github") {
    const query = form.githubQuery.trim();
    if (!query) return { ok: false, error: "Query GitHub không được để trống." };

    const minStars = parseInteger(form.githubMinStars, "Min stars", 50, 0);
    if (!minStars.ok) return minStars;

    const days = parseInteger(form.githubDays, "Số ngày", 14, 1);
    if (!days.ok) return days;

    return {
      ok: true,
      value: {
        type: "github",
        name: `GitHub · ${query}`,
        config: {
          query,
          min_stars: minStars.value,
          days: days.value,
        },
      },
    };
  }

  if (form.type === "hackernews") {
    const queries = Array.from(
      new Set(
        form.hnQueries
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    );
    if (queries.length === 0) {
      return { ok: false, error: "Queries Hacker News không được để trống." };
    }

    const minPoints = parseInteger(form.hnMinPoints, "Min points", 30, 0);
    if (!minPoints.ok) return minPoints;

    return {
      ok: true,
      value: {
        type: "hackernews",
        name: `Hacker News · ${queries.join(", ")}`,
        config: {
          queries,
          min_points: minPoints.value,
        },
      },
    };
  }

  const name = form.rssName.trim();
  if (!name) return { ok: false, error: "Tên nguồn RSS không được để trống." };

  const feedUrl = form.rssFeedUrl.trim();
  if (!feedUrl) return { ok: false, error: "Feed URL không được để trống." };
  if (!isHttpUrl(feedUrl)) {
    return {
      ok: false,
      error: "Feed URL phải là URL hợp lệ (http:// hoặc https://).",
    };
  }

  return {
    ok: true,
    value: { type: "rss", name, config: { url: feedUrl } },
  };
}

/** INSERT nguồn mới; trả row vừa tạo (kèm itemCount = 0). */
export async function createSource(
  client: SupabaseClient,
  payload: NewSourcePayload,
): Promise<ManagedSource> {
  const { data, error } = await client
    .from("sources")
    .insert({
      type: payload.type,
      name: payload.name,
      config: payload.config,
      enabled: true,
    })
    .select(SOURCE_FIELDS)
    .single();

  if (error) throw new Error(error.message);

  const row = data as unknown as Omit<ManagedSource, "itemCount">;
  return { ...row, config: (row.config ?? {}) as SourceConfig, itemCount: 0 };
}

/** Tóm tắt config dạng cặp key: value (giữ đúng giá trị JSON). */
export function configSummary(
  config: SourceConfig | null | undefined,
): { key: string; value: string }[] {
  if (!config) return [];

  return Object.entries(config).map(([key, value]) => ({
    key,
    value: configValue(value),
  }));
}

function configValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    return value.length === 0
      ? "—"
      : value.map((part) => String(part)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Lỗi ghi DB thường gặp -> hướng dẫn rõ thay vì message thô của PostgREST. */
export function writeErrorText(message: string): string {
  if (/row-level security|permission denied|42501/i.test(message)) {
    return "Chưa có quyền ghi bảng sources — chạy migration 20261021_sources_write.sql trong SQL Editor.";
  }
  if (/JWT|not authenticated|Auth session missing/i.test(message)) {
    return "Phiên đăng nhập đã hết hạn — đăng nhập lại rồi thử lại.";
  }
  return message;
}
