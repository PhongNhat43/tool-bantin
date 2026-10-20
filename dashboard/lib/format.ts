export type ScoreTier = "high" | "mid" | "low";

export function scoreTier(score: number): ScoreTier {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

/** "2 giờ trước", "3 ngày trước"... */
export function relativeTime(iso: string | null): string {
  if (!iso) return "không rõ thời gian";

  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "không rõ thời gian";

  const diffMs = Date.now() - time;
  if (diffMs < 0) return "vừa xong";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "1 ngày trước";
  if (days < 30) return `${days} ngày trước`;

  return new Date(iso).toLocaleDateString("vi-VN");
}

const TYPE_LABEL: Record<string, string> = {
  facebook: "Facebook",
  github: "GitHub",
  hackernews: "Hacker News",
  reddit: "Reddit",
  rss: "RSS",
  youtube: "YouTube",
};

export function typeLabel(type: string | null | undefined): string {
  if (!type) return "Nguồn";
  return TYPE_LABEL[type] ?? type;
}

/** Facebook thì hiện "Facebook · Tên group", nguồn khác chỉ hiện tên. */
export function sourceLine(
  name: string | null | undefined,
  type: string | null | undefined,
): string {
  const displayName = name?.trim() || "không rõ nguồn";
  const label = typeLabel(type);
  if (type === "facebook" && displayName !== label) {
    return `${label} · ${displayName}`;
  }
  return displayName;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

const ENGAGEMENT_LABEL: Record<string, string> = {
  reactions: "reactions",
  comments: "bình luận",
  stars: "sao",
  forks: "forks",
  points: "điểm",
  upvotes: "upvote",
  ratio: "ratio",
  downloads: "lượt tải",
  views: "lượt xem",
};

/** Chỉ lấy số liệu tương tác gốc, bỏ các key kỹ thuật (score_breakdown...). */
export function engagementParts(
  engagement: Record<string, unknown> | null,
): string[] {
  if (!engagement) return [];

  return Object.entries(engagement)
    .filter(([key, value]) => key !== "score_breakdown" && value != null)
    .map(([key, value]) => {
      const label = ENGAGEMENT_LABEL[key] ?? key;
      if (key === "ratio" && typeof value === "number") {
        return `ratio ${value.toFixed(2)}`;
      }
      return `${String(value)} ${label}`;
    });
}

export type Breakdown = {
  topic: number;
  engagement: number;
  recency: number;
  cross_source: number;
};

/** Đọc breakdown đã chấm sẵn trong engagement.score_breakdown — KHÔNG tính lại. */
export function scoreBreakdown(
  engagement: Record<string, unknown> | null,
): Breakdown | null {
  const raw = engagement?.score_breakdown;
  if (!raw || typeof raw !== "object") return null;

  const part = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  const b = raw as Record<string, unknown>;
  return {
    topic: part(b.topic),
    engagement: part(b.engagement),
    recency: part(b.recency),
    cross_source: part(b.cross_source),
  };
}
