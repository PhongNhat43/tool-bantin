export const READ_ITEMS_KEY = "read-items";
export const READ_ITEMS_LIMIT = 500;

/** Đọc id đã đọc từ localStorage; hỏng/không có thì coi như rỗng. */
export function loadReadIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(READ_ITEMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice(0, READ_ITEMS_LIMIT);
  } catch {
    return [];
  }
}

export function saveReadIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      READ_ITEMS_KEY,
      JSON.stringify(ids.slice(0, READ_ITEMS_LIMIT)),
    );
  } catch {
    // localStorage đầy/bị chặn — trạng thái đã đọc chỉ là tiện ích, không chặn feed.
  }
}

/** Thêm id vào đầu danh sách, bỏ trùng, cắt còn 500 id gần nhất. */
export function markIdRead(ids: string[], id: string): string[] {
  const next = [id, ...ids.filter((current) => current !== id)].slice(
    0,
    READ_ITEMS_LIMIT,
  );
  saveReadIds(next);
  return next;
}
