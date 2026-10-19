/**
 * Chấm điểm 1 tin theo AGENTS.md mục 6 (chốt 19/10/2026).
 *
 * Lib THUẦN TÚY: không import Supabase client, không đọc/ghi DB, không gọi mạng
 * → test được offline. Việc truy DB tìm tin trùng 24h (cross-source) là của
 * `run-cycle`; lib này chỉ nhận cờ `cross_source`.
 *
 * Thang điểm: chủ đề 0–40 + tương tác 0–30 + độ mới 0–20 + cross-source 0–10.
 * Tổng tối đa 100. Các thành phần đều làm tròn về số nguyên để:
 *   - `score` khớp tuyệt đối với tổng `breakdown`;
 *   - ghi thẳng được vào cột `items.score` (integer).
 */

import { matchKeywords } from "./keywords.ts";

export type SourceType =
  | "facebook"
  | "reddit"
  | "github"
  | "hackernews"
  | "rss";

/**
 * Số liệu tương tác thô đọc từ `items.engagement`.
 * Field nào nguồn không có thì để trống (coi như 0).
 */
export interface EngagementMetrics {
  /** Facebook: số reactions. */
  reactions?: number;
  /** Facebook: số comments. */
  comments?: number;
  /** Facebook: số shares (không dùng để chấm điểm). */
  shares?: number;
  /** Reddit: số upvotes. */
  upvotes?: number;
  /** Reddit: tỉ lệ upvote (0–1), dùng cho cổng T2. */
  ratio?: number;
  /** GitHub: số stars. */
  stars?: number;
  /** GitHub: số forks (không dùng để chấm điểm). */
  forks?: number;
  /** Hacker News: số points. */
  points?: number;
  /** Nguồn khác có thể thêm field riêng — không ảnh hưởng công thức. */
  [key: string]: number | undefined;
}

export interface ScoreInput {
  title: string;
  content?: string;
  /** Không dùng để chấm điểm; giữ lại cho run-cycle/dashboard tiện truyền nguyên item. */
  url?: string;
  /** ISO 8601. Ngày trong tương lai coi như 0h tuổi. */
  published_at: string;
  source_type: SourceType;
  engagement: EngagementMetrics;
  /** run-cycle đã truy DB và biết tin xuất hiện ở ≥2 nguồn độc lập trong 24h. */
  cross_source?: boolean;
}

export interface ScoreBreakdown {
  /** Chủ đề (T1): điểm `matchKeywords` trả về, 0–40. */
  topic: number;
  /** Tương tác (T2): nội suy tuyến tính, 0–30. */
  engagement: number;
  /** Độ mới: mốc 6/12/24/48h, 0–20. */
  recency: number;
  /** Trùng tin ở nguồn khác: 0 hoặc 10. */
  cross_source: number;
}

export interface ScoreResult {
  /** Tổng 4 thành phần, 0–100. */
  score: number;
  /** Có qua cổng T2 không. Không qua → score = 0, không chấm tiếp. */
  passed: boolean;
  /** JSON-serializable để lưu vào `items.engagement.score_breakdown`. */
  breakdown: ScoreBreakdown;
  /** Báo Telegram ngay, bất kể điểm. */
  notify_now: boolean;
  notify_reason?: string;
}

/** Ngưỡng T2 theo từng nguồn: `pass` = vừa qua (5 điểm), `hot` = 30 điểm. */
const THRESHOLDS: Record<
  Exclude<SourceType, "rss">,
  { pass: number; hot: number }
> = {
  facebook: { pass: 15, hot: 80 },
  reddit: { pass: 30, hot: 200 },
  github: { pass: 50, hot: 500 },
  hackernews: { pass: 30, hot: 100 },
};

/** Reddit còn phải đạt tỉ lệ upvote tối thiểu. */
const REDDIT_MIN_RATIO = 0.75;

/** RSS nằm trong allowlist nên tương tác cố định 15 điểm. */
const RSS_ENGAGEMENT_SCORE = 15;

/** Điểm tối đa từng thành phần (dùng cho tài liệu + test bất biến). */
export const MAX_SCORE = 40 + 30 + 20 + 10;

function emptyBreakdown(): ScoreBreakdown {
  return { topic: 0, engagement: 0, recency: 0, cross_source: 0 };
}

/** Số dương hữu hạn, còn lại (undefined/NaN/âm) → 0. */
function safeNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/** Số liệu tương tác dùng để chấm điểm, theo đúng định nghĩa từng nguồn. */
function engagementMetric(
  sourceType: SourceType,
  engagement: EngagementMetrics,
): number {
  switch (sourceType) {
    case "facebook":
      return safeNumber(engagement.reactions) + safeNumber(engagement.comments);
    case "reddit":
      return safeNumber(engagement.upvotes);
    case "github":
      return safeNumber(engagement.stars);
    case "hackernews":
      return safeNumber(engagement.points);
    case "rss":
      return 0; // RSS không chấm theo tương tác.
  }
}

/**
 * Cổng T2 — kiểm tra TRƯỚC khi chấm điểm.
 * GitHub/RSS luôn qua vì collector đã lọc sẵn.
 */
function passesGate(input: ScoreInput): boolean {
  switch (input.source_type) {
    case "facebook":
      return engagementMetric("facebook", input.engagement) >=
        THRESHOLDS.facebook.pass;
    case "reddit":
      return engagementMetric("reddit", input.engagement) >=
          THRESHOLDS.reddit.pass &&
        safeNumber(input.engagement.ratio) >= REDDIT_MIN_RATIO;
    case "hackernews":
      return engagementMetric("hackernews", input.engagement) >=
        THRESHOLDS.hackernews.pass;
    case "github":
    case "rss":
      return true;
  }
}

/**
 * Tương tác 0–30: nội suy tuyến tính giữa ngưỡng qua (5 điểm) và ngưỡng hot
 * (30 điểm). Dưới ngưỡng qua (chỉ xảy ra với GitHub vì collector đã lọc > 50)
 * kẹp về 5; trên hot kẹp về 30.
 */
function engagementScore(input: ScoreInput): number {
  if (input.source_type === "rss") return RSS_ENGAGEMENT_SCORE;

  const { pass, hot } = THRESHOLDS[input.source_type];
  const metric = engagementMetric(input.source_type, input.engagement);

  if (metric <= pass) return 5;
  if (metric >= hot) return 30;

  return Math.round(5 + ((metric - pass) / (hot - pass)) * 25);
}

/**
 * Tuổi tin tính bằng giờ. Ngày trong tương lai → 0h.
 * Ngày không parse được → `null` (coi như không xác định, recency 0).
 */
function ageHours(publishedAt: string, now: Date): number | null {
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) return null;

  const hours = (now.getTime() - published) / 3_600_000;
  return hours < 0 ? 0 : hours;
}

/** Độ mới 0–20 theo mốc 6/12/24/48h. */
function recencyScore(age: number | null): number {
  if (age === null) return 0;
  if (age < 6) return 20;
  if (age < 12) return 15;
  if (age < 24) return 10;
  if (age < 48) return 5;
  return 0;
}

/**
 * Tin có khớp từ khóa nhóm A (token/API miễn phí) không.
 *
 * Dùng `matchKeywords` (đọc `KEYWORDS` trong keywords.ts) và xét `group` chứ
 * KHÔNG xét điểm: `matchKeywords` ưu tiên A > B > C > D nên `group === "A"`
 * đúng khi text có ít nhất 1 từ khóa nhóm A, kể cả khi bị trừ điểm vì từ khóa
 * phủ định.
 */
function matchesGroupA(text: string): boolean {
  return matchKeywords(text).group === "A";
}

/** Tin đạt ngưỡng "hot" của nguồn (dùng cho luật báo ngay c). RSS không có ngưỡng hot. */
function isHot(input: ScoreInput): boolean {
  if (input.source_type === "rss") return false;
  return engagementMetric(input.source_type, input.engagement) >=
    THRESHOLDS[input.source_type].hot;
}

/**
 * Chấm điểm 1 tin.
 *
 * @param input Tin đã normalize.
 * @param now Mốc thời gian để tính tuổi tin (mặc định hiện tại) — cho phép
 *            test tất định.
 */
export function scoreItem(input: ScoreInput, now = new Date()): ScoreResult {
  // Cổng T2 chạy trước: không qua thì dừng hẳn, không chấm tiếp.
  if (!passesGate(input)) {
    return {
      score: 0,
      passed: false,
      breakdown: emptyBreakdown(),
      notify_now: false,
    };
  }

  const text = `${input.title ?? ""} ${input.content ?? ""}`.trim();
  const groupA = matchesGroupA(text);
  const age = ageHours(input.published_at, now);

  const breakdown: ScoreBreakdown = {
    topic: matchKeywords(text).score,
    engagement: engagementScore(input),
    recency: recencyScore(age),
    cross_source: input.cross_source === true ? 10 : 0,
  };

  const reasons: string[] = [];

  // (a) Nhóm A + bài còn mới (<24h).
  if (groupA && age !== null && age < 24) {
    reasons.push(`nhóm A + bài mới (${age.toFixed(1)}h)`);
  }

  // (b) Trùng tin ở ≥2 nguồn độc lập trong 24h (run-cycle xác nhận).
  if (input.cross_source === true) {
    reasons.push("cross-source (≥2 nguồn/24h)");
  }

  // (c) Nhóm A + engagement mức hot của nguồn (bất kể tuổi tin).
  if (groupA && isHot(input)) {
    reasons.push(
      `nhóm A + engagement hot (${
        engagementMetric(input.source_type, input.engagement)
      })`,
    );
  }

  const score = breakdown.topic + breakdown.engagement + breakdown.recency +
    breakdown.cross_source;

  const result: ScoreResult = {
    score,
    passed: true,
    breakdown,
    notify_now: reasons.length > 0,
  };
  if (result.notify_now) result.notify_reason = reasons.join("; ");

  return result;
}
