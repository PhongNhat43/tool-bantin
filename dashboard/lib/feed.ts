import type { Item } from "@/lib/items";

export const BANGKOK_TZ = "Asia/Bangkok";

const DAY_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CLOCK_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: BANGKOK_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const CLOCK_FULL_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: BANGKOK_TZ,
  dateStyle: "short",
  timeStyle: "short",
});

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: BANGKOK_TZ,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

function dateValue(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Ngày theo lịch Bangkok, dạng YYYY-MM-DD — không phụ thuộc múi giờ máy user. */
export function bangkokDayKey(iso: string | null | undefined): string | null {
  const time = dateValue(iso);
  if (time === null) return null;

  const parts = DAY_KEY_FORMAT.formatToParts(new Date(time));
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/** Cộng/trừ ngày trên key YYYY-MM-DD (dùng UTC để không lệch DST). */
export function shiftDayKey(key: string, delta: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(now = new Date()): string {
  return bangkokDayKey(now.toISOString()) ?? "";
}

/** 00:00 Bangkok của N ngày trước, trả ISO UTC để query PostgREST. */
export function startOfBangkokDay(daysAgo = 0, now = new Date()): string {
  const key = shiftDayKey(todayKey(now), -daysAgo);
  return new Date(`${key}T00:00:00+07:00`).toISOString();
}

export function formatClock(iso: string | null | undefined): string {
  const time = dateValue(iso);
  return time === null ? "—" : CLOCK_FORMAT.format(new Date(time));
}

export function formatClockFull(iso: string | null | undefined): string | undefined {
  const time = dateValue(iso);
  return time === null ? undefined : CLOCK_FULL_FORMAT.format(new Date(time));
}

export function formatDayLabel(key: string, today = todayKey()): string {
  const [, month, day] = key.split("-");
  if (key === shiftDayKey(today, -1)) return `Hôm qua · ${day}/${month}`;

  const time = dateValue(`${key}T12:00:00+07:00`);
  if (time === null) return key;

  const label = DAY_LABEL_FORMAT.format(new Date(time));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** true nếu published_at nằm trong `hours` giờ gần nhất (không tính tương lai). */
export function isPublishedWithin(
  iso: string | null | undefined,
  hours: number,
  nowMs = Date.now(),
): boolean {
  const time = dateValue(iso);
  if (time === null) return false;
  const diff = nowMs - time;
  return diff >= 0 && diff <= hours * 60 * 60 * 1000;
}

function newestFirst(a: Item, b: Item): number {
  const at = dateValue(a.published_at);
  const bt = dateValue(b.published_at);
  if (at === null && bt === null) return 0;
  if (at === null) return 1;
  if (bt === null) return -1;
  return bt - at;
}

function scoreThenNewest(a: Item, b: Item): number {
  return b.score - a.score || newestFirst(a, b);
}

export type DayGroup = {
  key: string;
  label: string;
  items: Item[];
};

export type FeedModel = {
  todayKey: string;
  todayTotal: number;
  hot: Item[];
  today: Item[];
  days: DayGroup[];
  unreadLast7: number;
  lastItemCreatedAt: string | null;
};

/** Gom item theo ngày Bangkok + tách "Cần xem ngay" (một item chỉ nằm 1 chỗ). */
export function buildFeed(
  items: Item[],
  readIds: ReadonlySet<string>,
  windowDays = 7,
  now = new Date(),
): FeedModel {
  const today = todayKey(now);
  const nowMs = now.getTime();

  const hot = items
    .filter(
      (item) => item.score >= 70 && isPublishedWithin(item.published_at, 48, nowMs),
    )
    .sort(newestFirst)
    .slice(0, 10);
  const hotIds = new Set(hot.map((item) => item.id));

  const todayAll = items.filter(
    (item) => bangkokDayKey(item.published_at) === today,
  );
  const todayItems = todayAll
    .filter((item) => !hotIds.has(item.id))
    .sort(scoreThenNewest);

  const dayKeys = new Set<string>();
  for (let offset = 1; offset <= windowDays; offset += 1) {
    dayKeys.add(shiftDayKey(today, -offset));
  }

  const grouped = new Map<string, Item[]>();
  for (const item of items) {
    if (hotIds.has(item.id)) continue;
    const key = bangkokDayKey(item.published_at);
    if (!key || key === today || !dayKeys.has(key)) continue;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  const days = [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, rows]) => ({
      key,
      label: formatDayLabel(key, today),
      items: rows.sort(scoreThenNewest),
    }));

  const unreadLast7 = items.filter(
    (item) =>
      isPublishedWithin(item.published_at, 24 * 7, nowMs) &&
      !readIds.has(item.id),
  ).length;

  let lastItemCreatedAt: string | null = null;
  let lastCreatedMs = -Infinity;
  for (const item of items) {
    const time = dateValue(item.created_at);
    if (time !== null && time > lastCreatedMs) {
      lastCreatedMs = time;
      lastItemCreatedAt = item.created_at;
    }
  }

  return {
    todayKey: today,
    todayTotal: todayAll.length,
    hot,
    today: todayItems,
    days,
    unreadLast7,
    lastItemCreatedAt,
  };
}
