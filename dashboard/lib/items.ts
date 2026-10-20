import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceRef = { name: string; type: string };

export type Item = {
  id: string;
  title: string;
  content: string | null;
  url: string;
  author: string | null;
  published_at: string | null;
  created_at: string | null;
  score: number;
  engagement: Record<string, unknown> | null;
  source_id: string;
  sources: SourceRef | SourceRef[] | null;
};

export type Source = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
};

const ITEM_FIELDS =
  "id, title, content, url, author, published_at, created_at, score, engagement, source_id, sources(name, type)";

export const PAGE_SIZE = 50;

export function sourceOf(item: Item): SourceRef | null {
  if (!item.sources) return null;
  return Array.isArray(item.sources) ? (item.sources[0] ?? null) : item.sources;
}

/** Fallback khi chưa đọc được run_cycle_result: created_at mới nhất trong items. */
export async function fetchLatestItemCreatedAt(
  client: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await client
    .from("items")
    .select("created_at")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const row = ((data ?? []) as unknown as { created_at: string | null }[])[0];
  return row?.created_at ?? null;
}

/**
 * Cửa sổ feed: mọi item published_at từ mốc `since` trở lại đây (mới nhất trước).
 * Phân trang 1000/lần để không bị giới hạn PostgREST khi dữ liệu dày.
 */
export async function fetchFeedWindow(
  client: SupabaseClient,
  since: string,
): Promise<Item[]> {
  const pageSize = 1000;
  const maxRows = 5000;
  const rows: Item[] = [];

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await client
      .from("items")
      .select(ITEM_FIELDS)
      .gte("published_at", since)
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as unknown as Item[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

/** PostgREST `.or()` ngăn cách bằng dấu phẩy và dùng ngoặc — bỏ ký tự phá cú pháp. */
function sanitizeQuery(q: string): string {
  return q.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
}

export type AllQuery = {
  q?: string;
  sourceId?: string;
  offset?: number;
  limit?: number;
};

/** Khối "Tất cả": mọi item mới nhất trước + tìm kiếm + lọc nguồn + phân trang. */
export async function fetchAllItems(
  client: SupabaseClient,
  { q = "", sourceId = "", offset = 0, limit = PAGE_SIZE }: AllQuery = {},
): Promise<Item[]> {
  let query = client
    .from("items")
    .select(ITEM_FIELDS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (sourceId) query = query.eq("source_id", sourceId);

  const term = sanitizeQuery(q);
  if (term) {
    query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Item[];
}

export async function fetchSources(client: SupabaseClient): Promise<Source[]> {
  const { data, error } = await client
    .from("sources")
    .select("id, name, type, enabled")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Source[];
}

export type RunCycleSummary = {
  ok?: boolean;
  sources_ok?: number;
  sources_failed?: number;
  scored?: number;
  notified_instant?: number;
  notified_digest?: number;
  error?: string;
};

export type RunCycleResult = {
  id: number;
  status_code: number;
  body: RunCycleSummary | null;
  created: string;
};

/** Kết quả HTTP gần nhất của run-cycle (RPC chỉ đọc, migration 20261021). */
export async function fetchLastRun(
  client: SupabaseClient,
): Promise<RunCycleResult | null> {
  const { data, error } = await client.rpc("run_cycle_result");
  if (error) throw new Error(error.message);
  return (data as RunCycleResult | null) ?? null;
}
