import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceRef = { name: string; type: string };

export type Item = {
  id: string;
  title: string;
  content: string | null;
  url: string;
  author: string | null;
  published_at: string | null;
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
  "id, title, content, url, author, published_at, score, engagement, source_id, sources(name, type)";

export const PAGE_SIZE = 50;

export function sourceOf(item: Item): SourceRef | null {
  if (!item.sources) return null;
  return Array.isArray(item.sources) ? (item.sources[0] ?? null) : item.sources;
}

/** Khối "Cần xem ngay": score >= 70, mới nhất trước, tối đa 20. */
export async function fetchTopItems(client: SupabaseClient): Promise<Item[]> {
  const { data, error } = await client
    .from("items")
    .select(ITEM_FIELDS)
    .gte("score", 70)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Item[];
}

/** Khối "Hôm nay": 40 <= score < 70, published_at trong 24h, tối đa 30. */
export async function fetchTodayItems(client: SupabaseClient): Promise<Item[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("items")
    .select(ITEM_FIELDS)
    .gte("score", 40)
    .lt("score", 70)
    .gte("published_at", since)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Item[];
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
